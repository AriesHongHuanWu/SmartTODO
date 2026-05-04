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
      existingTasksText = JSON.stringify(existingTasks, null, 2);
    }

    const now = new Date().toISOString();
    const prompt = `You are a task extraction AI. The current date and time is: ${now}

Analyze the chat log below. The chat log includes the text, the URL of the chat (threadUrl), and the site name.

RULES:
1. Identify NEW actionable tasks. For each, provide: title, context, category, dueDate, threadUrl, and siteName.
2. 'category' must be one of: 'work', 'personal', 'shopping', 'meeting', 'homework', 'general'.
3. 'dueDate' should be in ISO 8601 format (e.g. '2026-05-05T10:00:00Z') or null if no specific time is mentioned. Guess the year as ${new Date().getFullYear()} if omitted.
4. Compare against Existing Pending Tasks. If a new message implies a change (e.g. rescheduling) to an existing task, return an action of "update" and the EXACT title of the existing task so we can update it.
5. Provide the original URL where the task was discussed in 'threadUrl'.
6. Return output in STRICT JSON format matching this schema:
{
  "tasks": [
    {
      "action": "create" | "update",
      "targetTitle": "Title of existing task" (only if action is update),
      "title": "Task title",
      "context": "Why we need to do this based on chat",
      "category": "work",
      "dueDate": "2026-05-05T10:00:00Z" | null,
      "threadUrl": "https://messenger.com/t/...",
      "siteName": "messenger.com"
    }
  ]
}

Existing Pending Tasks:
${existingTasksText}

Chat Logs:
${JSON.stringify(chatLogs, null, 2)}
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
