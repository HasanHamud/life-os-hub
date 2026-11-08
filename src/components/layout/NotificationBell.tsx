import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationSentence,
  notificationState,
  opensMemberWorkspace,
  subscribeNotifications,
  type Notice,
} from "@/core/notifications";
import { authState, setWorkspaceView } from "@/core/session";

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const [windowsOn, setWindowsOn] = useState(
    () => window.isSecureContext && "Notification" in window && Notification.permission === "granted",
  );
  const secure = window.isSecureContext && "Notification" in window;
  const { items, unread } = notificationState();

  useEffect(() => subscribeNotifications(() => setTick((n) => n + 1)), []);

  const open = (row: Notice) => {
    void markNotificationRead(row.id);
    const me = authState().user;
    if (me?.role === "admin" && me.id !== row.actorId && opensMemberWorkspace(row.href)) {
      setWorkspaceView({ id: row.actorId, name: row.actorName });
    } else if (me?.role === "admin") {
      setWorkspaceView(null);
    }
    const task = /^\/tasks\/([^/]+)$/.exec(row.href);
    if (task) {
      void navigate({ to: "/tasks/$taskId", params: { taskId: task[1] } });
      return;
    }
    if (row.href === "/journal") {
      void navigate({ to: "/journal" });
      return;
    }
    void navigate({ to: "/tasks" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative grid h-11 w-11 place-items-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent md:h-8 md:w-8"
          aria-label={t("notifications.aria")}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute end-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-[11px] leading-none text-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="text-sm font-medium">{t("notifications.title")}</div>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => void markAllNotificationsRead()}
            >
              {t("notifications.markAll")}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">{t("notifications.empty")}</div>
          ) : (
            items.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => open(row)}
                className="block w-full border-b px-3 py-2 text-start last:border-b-0 hover:bg-accent"
              >
                <div className={row.readAt ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
                  {notificationSentence(row)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </button>
            ))
          )}
        </div>
        {secure && (
          <div className="border-t px-3 py-2">
            {windowsOn ? (
              <div className="text-xs text-muted-foreground">{t("notifications.windowsOn")}</div>
            ) : (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => {
                  void Notification.requestPermission().then((result) => setWindowsOn(result === "granted"));
                }}
              >
                {t("notifications.enableWindows")}
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
