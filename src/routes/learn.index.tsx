import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";
import { useLearnStore } from "@/core/learn-store";
import { PageHeader } from "@/components/layout/PageHeader";
import { DailyModuleCard } from "@/components/learn/DailyModuleCard";
import { RotationWidget } from "@/components/learn/RotationWidget";
import { RotationDialog } from "@/components/learn/RotationDialog";
import { InsightCard } from "@/components/learn/InsightCard";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Lightbulb, BookOpen, Code, Brain } from "lucide-react";

export const Route = createFileRoute("/learn/")({
  head: () => ({
    meta: [
      { title: i18n.t("meta.learn") },
      { name: "description", content: i18n.t("meta.learnDesc") },
    ],
  }),
  component: LearnHub,
});

function LearnHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    insights, concepts, problems, sessions, rotation,
    deleteInsight, upsertRotationEntry, deleteRotationEntry,
  } = useLearnStore();
  const [editInsight, setEditInsight] = useState<string | null>(null);
  const [rotationOpen, setRotationOpen] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayInsights = insights.filter((i) => i.date === today);
  const recentInsights = useMemo(
    () => [...insights].filter((i) => i.date !== today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [insights],
  );

  const stats = [
    { label: t("learn.concepts"), value: concepts.length, icon: Brain, color: "text-primary" },
    { label: t("learn.insights"), value: insights.length, icon: Lightbulb, color: "text-warning" },
    { label: t("learn.problems"), value: problems.length, icon: Code, color: "text-success" },
    { label: t("learn.sessions"), value: sessions.length, icon: BookOpen, color: "text-info" },
  ];

  return (
    <div>
      <PageHeader
        title={t("learn.title")}
        description={t("learn.description")}
      />

      <div className="space-y-4">
        <DailyModuleCard
          onStartSession={() => navigate({ to: "/learn/insights" })}
          onConfigure={() => setRotationOpen(true)}
        />

        <div className="grid md:grid-cols-4 gap-3">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                {label}
              </div>
              <div className="text-2xl font-display font-semibold tabular-nums">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {todayInsights.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {t("learn.todayInsights")}
                </h3>
                <div className="space-y-2">
                  {todayInsights.map((insight) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      onEdit={() => setEditInsight(insight.id)}
                      onDelete={async () => { await deleteInsight(insight.id); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {recentInsights.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {t("learn.recent")}
                </h3>
                <div className="space-y-2">
                  {recentInsights.map((insight) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      onEdit={() => setEditInsight(insight.id)}
                      onDelete={async () => { await deleteInsight(insight.id); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {insights.length === 0 && (
              <div className="text-center py-16 text-sm text-muted-foreground">
                {t("learn.empty")}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <RotationWidget onConfigure={() => setRotationOpen(true)} />
          </div>
        </div>
      </div>

      <RotationDialog
        open={rotationOpen}
        onOpenChange={setRotationOpen}
        rotation={rotation}
        onUpsert={upsertRotationEntry}
        onDelete={deleteRotationEntry}
      />
    </div>
  );
}
