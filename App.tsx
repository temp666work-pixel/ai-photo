import React, { useState, useRef, useCallback } from 'react';
import { Camera, Sparkles, Upload, Image as ImageIcon, Download, Loader2, RefreshCw, User, Settings2, Briefcase, Coffee, Flame } from 'lucide-react';
import { analyzeAndPlanSession, generateSingleImage, blobToBase64 } from './services/geminiService';
import { GenerationPlan, Scenario, GeneratedImage } from './types';

const App: React.FC = () => {
  // State
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Configuration
  const [photoCount, setPhotoCount] = useState<number>(10);
  const [genderPref, setGenderPref] = useState<string>('auto');
  const [outfitStyle, setOutfitStyle] = useState<string>('sexy');
  
  // Generation State
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'generating' | 'complete' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [currentPlan, setCurrentPlan] = useState<GenerationPlan | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [progress, setProgress] = useState<number>(0);

  // Inputs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      try {
        const file = e.target.files[0];
        // Let's rely on standard FileReader for display to be safe
        const reader = new FileReader();
        reader.onload = (ev) => {
            setSourceImage(ev.target?.result as string);
            setIsUploading(false);
            // Reset previous sessions
            setGeneratedImages([]);
            setCurrentPlan(null);
            setStatus('idle');
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("File read error", err);
        setIsUploading(false);
      }
    }
  };

  const startGeneration = async () => {
    if (!sourceImage) return;

    try {
      setStatus('analyzing');
      setStatusMessage('Analyzing physical features & planning scenarios...');
      setProgress(10);

      // Extract proper mime type and base64 data
      const matches = sourceImage.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        throw new Error("Invalid image data format");
      }
      const mimeType = matches[1];
      const apiBase64 = matches[2];

      // Phase 1: Plan
      const plan = await analyzeAndPlanSession(apiBase64, mimeType, photoCount, genderPref, outfitStyle);
      setCurrentPlan(plan);
      setStatus('generating');
      setProgress(30);

      // Phase 2: Generate
      const newImages: GeneratedImage[] = [];
      const total = plan.scenarios.length;
      
      for (let i = 0; i < total; i++) {
        const scenario = plan.scenarios[i];
        setStatusMessage(`Generating image ${i + 1} of ${total}: ${scenario.styleName}...`);
        
        try {
          const resultBase64 = await generateSingleImage(apiBase64, mimeType, scenario, plan.physicalDescription);
          
          const newImg: GeneratedImage = {
            id: Date.now().toString() + i,
            url: resultBase64,
            scenario: scenario
          };
          
          newImages.push(newImg);
          setGeneratedImages(prev => [...prev, newImg]);
          
          // Update progress
          const percentage = 30 + ((i + 1) / total) * 70;
          setProgress(Math.min(percentage, 100));
          
        } catch (err) {
          console.error(`Failed to generate scenario ${i}`, err);
          // Continue to next even if one fails
        }
      }

      setStatus('complete');
      setStatusMessage('Portfolio generation complete!');

    } catch (error) {
      console.error(error);
      setStatus('error');
      setStatusMessage('An error occurred during generation. Please try again.');
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    generatedImages.forEach((img, index) => {
      // Stagger downloads slightly to prevent browser throttling
      setTimeout(() => {
        handleDownload(img.url, `persona-${img.id}.png`);
      }, index * 500);
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-indigo-500/30">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                PersonaAI
              </span>
            </div>
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Powered by Gemini 2.5</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Controls */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Upload Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-400" />
                Source Subject
              </h2>
              
              <div 
                className={`relative group cursor-pointer border-2 border-dashed rounded-xl transition-all duration-300 h-64 flex flex-col items-center justify-center overflow-hidden
                  ${sourceImage ? 'border-indigo-500/50 bg-gray-900' : 'border-gray-700 hover:border-indigo-500 hover:bg-gray-800/50'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                {sourceImage ? (
                  <>
                    <img src={sourceImage} alt="Source" className="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 p-3 rounded-full backdrop-blur-sm">
                        <RefreshCw className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-300">Upload a clear selfie</p>
                    <p className="text-xs text-gray-500 mt-1">JPG or PNG. Face clearly visible.</p>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileSelect}
                />
              </div>
            </div>

            {/* Configuration Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
               <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                Configuration
              </h2>

              <div className="space-y-6">
                
                {/* Style Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Outfit Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setOutfitStyle('formal')}
                      disabled={status === 'analyzing' || status === 'generating'}
                      className={`py-3 px-2 rounded-lg text-xs font-medium transition-colors border flex flex-col items-center gap-1
                        ${outfitStyle === 'formal' 
                          ? 'bg-indigo-600 border-indigo-500 text-white' 
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                      <Briefcase className="w-4 h-4" />
                      Formal
                    </button>
                    <button
                      onClick={() => setOutfitStyle('casual')}
                      disabled={status === 'analyzing' || status === 'generating'}
                      className={`py-3 px-2 rounded-lg text-xs font-medium transition-colors border flex flex-col items-center gap-1
                        ${outfitStyle === 'casual' 
                          ? 'bg-indigo-600 border-indigo-500 text-white' 
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                      <Coffee className="w-4 h-4" />
                      Casual
                    </button>
                    <button
                      onClick={() => setOutfitStyle('sexy')}
                      disabled={status === 'analyzing' || status === 'generating'}
                      className={`py-3 px-2 rounded-lg text-xs font-medium transition-colors border flex flex-col items-center gap-1
                        ${outfitStyle === 'sexy' 
                          ? 'bg-rose-600 border-rose-500 text-white' 
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-rose-400'
                        }`}
                    >
                      <Flame className="w-4 h-4" />
                      +18 Bold
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Gender Preference</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['auto', 'female', 'male'].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setGenderPref(opt)}
                        disabled={status === 'analyzing' || status === 'generating'}
                        className={`py-2 px-3 rounded-lg text-sm capitalize transition-colors border
                          ${genderPref === opt 
                            ? 'bg-indigo-600 border-indigo-500 text-white' 
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                          }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">Variations Count</label>
                    <span className="text-sm text-indigo-400 font-bold">{photoCount}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={photoCount}
                    onChange={(e) => setPhotoCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    disabled={status === 'analyzing' || status === 'generating'}
                  />
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    <span>1</span>
                    <span>20</span>
                  </div>
                </div>

                <button
                  onClick={startGeneration}
                  disabled={!sourceImage || status === 'analyzing' || status === 'generating'}
                  className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 transition-all
                    ${!sourceImage || status === 'analyzing' || status === 'generating'
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.02]'
                    }`}
                >
                  {status === 'analyzing' || status === 'generating' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Portfolio
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Status / Plan Log */}
            {(status !== 'idle' || currentPlan) && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-300">Session Status</h3>
                    <span className="text-xs text-indigo-400 font-mono">{Math.round(progress)}%</span>
                 </div>
                 
                 {/* Progress Bar */}
                 <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mb-4">
                   <div 
                    className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                   />
                 </div>

                 <p className="text-sm text-gray-400 mb-4 animate-pulse">
                   {statusMessage}
                 </p>

                 {currentPlan && (
                   <div className="bg-gray-950/50 rounded-lg p-3 border border-gray-800/50">
                     <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Detected Subject</p>
                     <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed">
                       {currentPlan.physicalDescription}
                     </p>
                   </div>
                 )}
              </div>
            )}
          </div>

          {/* Right Panel: Gallery */}
          <div className="lg:col-span-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Generated Portfolio</h2>
              {generatedImages.length > 0 && (
                <button 
                  onClick={handleDownloadAll}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download All
                </button>
              )}
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-3xl min-h-[600px] p-6 relative">
              
              {generatedImages.length === 0 && status === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                   <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                   <p className="text-lg font-medium opacity-50">Your generated portfolio will appear here</p>
                </div>
              )}

              {generatedImages.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {generatedImages.map((img) => (
                    <div key={img.id} className="group relative bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl transition-all hover:border-indigo-500/30 animate-in zoom-in-95 duration-500">
                      <div className="aspect-[3/4] relative overflow-hidden">
                        <img 
                          src={img.url} 
                          alt={img.scenario.styleName} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                          <button 
                            onClick={() => handleDownload(img.url, `persona-${img.id}.png`)}
                            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-md p-2 rounded-full text-white transition-colors"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                          
                          <h3 className="text-white font-bold text-lg translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                            {img.scenario.styleName}
                          </h3>
                          <p className="text-gray-300 text-xs mt-1 translate-y-2 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                            {img.scenario.outfit} • {img.scenario.location}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Skeleton Loader for pending images */}
                  {status === 'generating' && generatedImages.length < photoCount && (
                    <div className="aspect-[3/4] rounded-2xl bg-gray-800/30 border border-gray-800 flex items-center justify-center animate-pulse">
                      <Loader2 className="w-8 h-8 text-gray-600 animate-spin" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;