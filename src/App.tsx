import { useState, useRef, useEffect } from "react";
import { StoryBeat, GameState, ImageSize, Role } from "./types";
import { ScrollText, Backpack, Settings, ChevronRight, Loader2, Send } from "lucide-react";

export default function App() {
  const [history, setHistory] = useState<StoryBeat[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    inventory: [],
    quest: "Find your purpose.",
  });
  const [imageSize, setImageSize] = useState<ImageSize>("1K");
  const [action, setAction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize game on first load
  useEffect(() => {
    if (history.length === 0) {
      handleAction("Look around.");
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleAction = async (userAction: string) => {
    if (!userAction.trim() || isLoading) return;

    setIsLoading(true);

    const newHistory = [...history];
    if (history.length > 0) {
      newHistory.push({
        id: Date.now().toString(),
        role: "user",
        text: userAction,
      });
      setHistory(newHistory);
      setAction("");
    }

    try {
      // 1. Get the story text & state updates
      const storyRes = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only send text history
          history: newHistory.map((item) => ({ role: item.role, text: item.text })),
          inventory: gameState.inventory,
          quest: gameState.quest,
          action: userAction,
        }),
      });

      if (!storyRes.ok) throw new Error("Failed to fetch story.");
      const data = await storyRes.json();

      setGameState({
        inventory: data.inventory || [],
        quest: data.quest || "No active quest.",
      });

      const modelBeatId = (Date.now() + 1).toString();
      setHistory((prev) => [
        ...prev,
        {
          id: modelBeatId,
          role: "model",
          text: data.story,
          imagePrompt: data.imagePrompt,
          isLoadingImage: true,
        },
      ]);
      
      setIsLoading(false); // Text is complete, allow new actions while image loads

      // 2. Fetch the image
      if (data.imagePrompt) {
        fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: data.imagePrompt,
            size: imageSize,
          }),
        })
          .then((res) => {
             if(!res.ok) throw new Error("Failed to fetch image");
             return res.json();
          })
          .then((imgData) => {
            setHistory((prev) =>
              prev.map((beat) =>
                beat.id === modelBeatId
                  ? { ...beat, imageUrl: imgData.imageBase64, isLoadingImage: false }
                  : beat
              )
            );
          })
          .catch((err) => {
            console.error("Image gen failed", err);
            setHistory((prev) =>
              prev.map((beat) =>
                beat.id === modelBeatId
                  ? { ...beat, isLoadingImage: false, text: beat.text + "\n\n*(Failed to load image)*" }
                  : beat
              )
            );
          });
      }

    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setHistory((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "model",
          text: "The universe seems to have glitched. Try your action again.",
        },
      ]);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-700 bg-slate-800 flex flex-col hidden md:flex shrink-0">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-emerald-400" />
            Endless Realms
          </h1>
          <p className="text-slate-400 text-sm mt-2">AI-Driven Infinite Adventure</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Quest Section */}
          <div className="mb-8">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ScrollText className="w-4 h-4" /> Current Quest
            </h2>
            <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
              <p className="text-slate-200 text-sm leading-relaxed">
                {gameState.quest}
              </p>
            </div>
          </div>

          {/* Inventory Section */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Backpack className="w-4 h-4" /> Inventory
            </h2>
            {gameState.inventory.length === 0 ? (
              <p className="text-slate-500 text-sm italic py-2">Your pockets are empty.</p>
            ) : (
              <ul className="space-y-2">
                {gameState.inventory.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-300"
                  >
                    <div className="w-2 h-2 rounded-full bg-cyan-500" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800/80">
          <label className="text-xs font-medium text-slate-400 flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4" /> Image Quality
          </label>
          <select
            value={imageSize}
            onChange={(e) => setImageSize(e.target.value as ImageSize)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-300 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          >
            <option value="1K">Standard (1K)</option>
            <option value="2K">High (2K)</option>
            <option value="4K">Ultra (4K)</option>
          </select>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Story Thread */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
          {history.length === 0 && isLoading && (
             <div className="flex justify-center items-center h-full">
               <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
             </div>
          )}
          {history.map((beat) => (
            <div
              key={beat.id}
              className={`flex flex-col ${beat.role === "user" ? "items-end" : "items-start"}`}
            >
              {beat.role === "user" ? (
                <div className="max-w-[80%] bg-cyan-900/30 text-cyan-100 border border-cyan-800/50 rounded-2xl rounded-tr-sm px-5 py-3 text-sm md:text-base">
                  <span className="font-semibold text-cyan-400 mr-2">&gt;</span>
                  {beat.text}
                </div>
              ) : (
                <div className="max-w-3xl w-full space-y-4">
                  {beat.imageUrl ? (
                    <div className="w-full aspect-video md:aspect-[21/9] rounded-xl overflow-hidden border border-slate-800 bg-slate-900 relative shadow-2xl">
                      <img
                        src={`data:image/jpeg;base64,${beat.imageUrl}`}
                        className="w-full h-full object-cover"
                        alt="Scene illustration"
                      />
                      <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl" />
                    </div>
                  ) : beat.isLoadingImage ? (
                    <div className="w-full aspect-video md:aspect-[21/9] rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex items-center justify-center flex-col gap-3">
                      <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
                      <p className="text-xs text-slate-500 animate-pulse tracking-wider uppercase">Visualizing scene...</p>
                    </div>
                  ) : null}
                  <div className="prose prose-invert prose-slate max-w-none">
                    <p className="text-slate-300 leading-relaxed text-base md:text-lg whitespace-pre-wrap">
                      {beat.text}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Action Input */}
        <div className="p-4 md:p-6 border-t border-slate-800 bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAction(action);
            }}
            className="max-w-4xl mx-auto relative group"
          >
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <ChevronRight className="w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
            </div>
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder={isLoading && history.length === 0 ? "Summoning the world..." : "What do you do next?"}
              disabled={isLoading && history.length === 0}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-base md:text-lg rounded-full py-4 pl-12 pr-16 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-500 shadow-lg"
              autoFocus
            />
            <button
              type="submit"
              disabled={!action.trim() || isLoading}
              className="absolute inset-y-2 right-2 px-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full flex flex-col justify-center transition-colors"
            >
              {isLoading && history.length > 0 ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5 ml-0.5" />
              )}
            </button>
          </form>
          <div className="max-w-4xl mx-auto mt-2 flex justify-between items-center text-xs text-slate-500 px-4">
             <span>Press Enter to perform action</span>
             {isLoading && history.length > 0 && <span className="animate-pulse text-cyan-500">Writing next chapter...</span>}
          </div>
        </div>
      </main>
    </div>
  );
}

