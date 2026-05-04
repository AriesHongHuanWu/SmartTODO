import { Download, Puzzle, Settings, CheckCircle } from "lucide-react";

export default function DownloadExtension() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Get the Chrome Extension</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Install the SmartTODO extension to extract tasks directly from your Messenger chats with one click.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 mb-12">
        <div className="p-8 text-center bg-blue-50 border-b border-blue-100">
          <Puzzle className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">SmartTODO Messenger Extractor</h2>
          <p className="text-gray-600 mb-6">Manifest V3 Chrome Extension powered by Gemini AI</p>
          <a
            href="/extension.zip"
            download
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Download className="w-5 h-5 mr-2" />
            Download Extension.zip
          </a>
        </div>

        <div className="p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Installation Guide (Developer Mode)</h3>
          
          <div className="space-y-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 font-bold">1</div>
              </div>
              <div className="ml-4">
                <h4 className="text-lg font-medium text-gray-900">Unzip the downloaded file</h4>
                <p className="mt-1 text-gray-500">Extract the contents of `extension.zip` to a folder on your computer.</p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 font-bold">2</div>
              </div>
              <div className="ml-4">
                <h4 className="text-lg font-medium text-gray-900">Open Chrome Extensions</h4>
                <p className="mt-1 text-gray-500">In your Chrome browser, type <code className="bg-gray-100 px-2 py-1 rounded text-sm text-pink-600">chrome://extensions/</code> in the address bar and press Enter.</p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 font-bold">3</div>
              </div>
              <div className="ml-4">
                <h4 className="text-lg font-medium text-gray-900">Enable Developer mode</h4>
                <p className="mt-1 text-gray-500">Toggle the <strong>Developer mode</strong> switch in the top right corner of the extensions page to the ON position.</p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 font-bold">4</div>
              </div>
              <div className="ml-4">
                <h4 className="text-lg font-medium text-gray-900">Load unpacked extension</h4>
                <p className="mt-1 text-gray-500">Click the <strong>Load unpacked</strong> button that appears in the top left, and select the folder where you extracted the extension files.</p>
              </div>
            </div>
            
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="ml-4">
                <h4 className="text-lg font-medium text-gray-900">Done!</h4>
                <p className="mt-1 text-gray-500">Click the extension puzzle icon in your browser toolbar, pin SmartTODO, click it to log in, and you're ready to sync from Messenger.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
