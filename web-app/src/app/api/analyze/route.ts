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
    const { chatLogs, userId } = body;

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

    const prompt = `Analyze the chat log below. 
1. Identify new actionable tasks for the user. For each task, provide a short 'title' and a 'context' sentence explaining who asked for it or why.
2. Identify if any existing tasks have been completed based on context. Provide just the title of the completed task.
3. If the conversation is just casual chat and does not contain any actionable To-Do tasks, simply return empty arrays []. Do NOT invent tasks.

Output strictly in JSON format:
{
  "newTasks": [
    { "title": "Buy milk", "context": "Alice asked you to buy milk on the way home" }
  ],
  "completedTasks": ["task 3"]
}

Chat Log:
${chatLogs.join('\n')}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up markdown if any
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedData = { newTasks: [], completedTasks: [] };
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

