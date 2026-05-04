import Link from "next/link";
import { ArrowRight, Download, CheckCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center">
        <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
          <span className="block">Extract Tasks from</span>
          <span className="block text-blue-600">Messenger with AI</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          SmartTODO automatically analyzes your Messenger conversations, identifies actionable items, and syncs them directly to your to-do list.
        </p>
        <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
          <div className="rounded-md shadow">
            <Link
              href="/login"
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10"
            >
              Get Started
            </Link>
          </div>
          <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
            <Link
              href="/download-extension"
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
            >
              Get Extension <Download className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
      
      <div className="mt-24 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div className="pt-6">
          <div className="flow-root bg-white rounded-lg px-6 pb-8 shadow h-full">
            <div className="-mt-6">
              <div>
                <span className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-md shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" aria-hidden="true" />
                </span>
              </div>
              <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">AI Powered</h3>
              <p className="mt-5 text-base text-gray-500">
                Uses Google's Gemini LLM to accurately understand context and identify tasks from natural conversation.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <div className="flow-root bg-white rounded-lg px-6 pb-8 shadow h-full">
            <div className="-mt-6">
              <div>
                <span className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-md shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" aria-hidden="true" />
                </span>
              </div>
              <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">Real-time Sync</h3>
              <p className="mt-5 text-base text-gray-500">
                Tasks extracted in Messenger instantly appear in your dashboard using Firebase real-time updates.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <div className="flow-root bg-white rounded-lg px-6 pb-8 shadow h-full">
            <div className="-mt-6">
              <div>
                <span className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-md shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" aria-hidden="true" />
                </span>
              </div>
              <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">Auto Completion</h3>
              <p className="mt-5 text-base text-gray-500">
                SmartTODO can automatically detect when you discuss completing a task and update its status.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
