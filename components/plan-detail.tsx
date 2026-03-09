"use client";

interface PlanStep {
  step: string;
  difficulty: "easy" | "medium" | "hard";
  cost: string;
  tool?: string;
}

interface ToolInfo {
  name: string;
  url: string;
  cost: string;
}

interface PlanDetailProps {
  plan: PlanStep[];
  tools: ToolInfo[];
  weaknesses: string;
}

const difficultyColors: Record<string, string> = {
  easy: "bg-green-900/50 text-green-300 border-green-700",
  medium: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  hard: "bg-red-900/50 text-red-300 border-red-700",
};

export default function PlanDetail({ plan, tools, weaknesses }: PlanDetailProps) {
  return (
    <div className="space-y-4 pt-3">
      {/* Steps */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Action Plan
        </h4>
        <ol className="space-y-2">
          {plan.map((step, i) => (
            <li key={i} className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200">{step.step}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${difficultyColors[step.difficulty] || difficultyColors.medium}`}
                  >
                    {step.difficulty}
                  </span>
                  <span className="text-xs text-gray-500">{step.cost}</span>
                  {step.tool && (
                    <span className="text-xs text-blue-400">{step.tool}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Tools */}
      {tools.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Tools & Costs
          </h4>
          <div className="grid gap-2">
            {tools.map((tool, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm text-gray-200">{tool.name}</span>
                  {tool.url && (
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 ml-2 hover:underline"
                    >
                      {tool.url}
                    </a>
                  )}
                </div>
                <span className="text-xs text-gray-400 font-mono">{tool.cost}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weaknesses */}
      {weaknesses && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Potential Improvements
          </h4>
          <p className="text-sm text-gray-400">{weaknesses}</p>
        </div>
      )}
    </div>
  );
}
