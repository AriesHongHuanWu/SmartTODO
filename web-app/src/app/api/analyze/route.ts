import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mark this route to be dynamically rendered for Edge/SSR
export const runtime = 'edge'; 

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const body = await request.json();
    const { chatLogs, userId, existingTasks } = body;

    if (!chatLogs || !Array.isArray(chatLogs)) {
      return NextResponse.json({ error: 'Invalid chat logs provided.' }, { status: 400, headers: corsHeaders });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 401, headers: corsHeaders });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured on server.' }, { status: 500, headers: corsHeaders });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

    // Build existing tasks context for the AI
    let existingTasksBlock = '';
    if (existingTasks && Array.isArray(existingTasks) && existingTasks.length > 0) {
      existingTasksBlock = `
The user currently has these pending tasks:
${existingTasks.map((t: any, i: number) => `${i + 1}. "${t.title}" (category: ${t.category || 'general'}${t.dueDate ? ', due: ' + t.dueDate : ''})`).join('\n')}

If you detect that any of these tasks have been COMPLETED based on the chat, include them in "completedTasks".
If you detect that any of these tasks have CHANGED (e.g. rescheduled, details modified), include them in "updatedTasks" with the original title and the new fields.
`;
    }

    const now = new Date().toISOString();
    const prompt = `You are a task extraction AI. The current date and time is: ${now}

Analyze the chat log below.

RULES:
1. Identify NEW actionable tasks. For each, provide: title, context, category, and dueDate.
2. Categories MUST be one of: general, meeting, homework, shopping, work, personal
3. If you can detect a deadline from the conversation (e.g. "by Friday", "before 3pm tomorrow"), set dueDate as an ISO 8601 string. Otherwise set it to null.
4. If the conversation is just casual chat with NO actionable tasks, return empty arrays. Do NOT invent tasks.
5. Detect if existing tasks have been completed or updated/rescheduled.
${existingTasksBlock}
Output strictly in JSON format:
{
  "newTasks": [
    { "title": "Buy milk", "context": "Alice asked you to buy milk on the way home", "category": "shopping", "dueDate": null }
  ],
  "completedTasks": ["Buy milk"],
  "updatedTasks": [
    { "originalTitle": "Team meeting at 2pm", "title": "Team meeting at 3pm", "context": "Bob rescheduled the meeting to 3pm", "category": "meeting", "dueDate": "2026-05-05T15:00:00Z" }
  ]
}

Chat Log:
${chatLogs.join('\n')}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up markdown if any
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedData = { newTasks: [], completedTasks: [], updatedTasks: [] };
    try {
      parsedData = JSON.parse(text);
    } catch (e) {
      console.warn("AI returned non-JSON or empty response", text);
    }

    return NextResponse.json(parsedData, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error analyzing chat:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze chat' }, { status: 500, headers: corsHeaders });
  }
}
