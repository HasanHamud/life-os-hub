import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import i18n from "@/core/i18n";
import { translateError } from "@/core/locale";
import { authState, setAvatar, subscribeAuth, updateProfile, viewUserId } from "@/core/session";
import { useStore } from "@/core/store";
import { focusMinutesOnDay, formatWhen, isOverdue } from "@/core/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [
    { title: i18n.t("meta.profile") },
    { name: "description", content: i18n.t("meta.profileDesc") },
  ]}),
  component: ProfilePage,
});

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((part) => part[0]).join("");
}

function personTint(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return { background: `oklch(0.9 0.045 ${hue})`, color: `oklch(0.32 0.06 ${hue})` };
}

function fitPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("read"));
        return;
      }
      const scale = Math.max(128 / image.width, 128 / image.height);
      ctx.drawImage(image, (128 - image.width * scale) / 2, (128 - image.height * scale) / 2, image.width * scale, image.height * scale);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("read"));
    };
    image.src = url;
  });
}

function ProfilePage() {
  const { t } = useTranslation();
  const user = useSyncExternalStore(subscribeAuth, () => authState().user);
  const viewingOther = useSyncExternalStore(subscribeAuth, () => !!viewUserId());
  const tasks = useStore((s) => s.tasks);
  const sessions = useStore((s) => s.sessions);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
  }, [user?.id, user?.name, user?.email]);

  if (!user) return null;

  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const overdue = tasks.filter(isOverdue).length;
  const focusToday = focusMinutesOnDay(sessions, new Date());
  const emailChanged = email.trim().toLowerCase() !== user.email;
  const passwordChanging = newPassword.length > 0;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if ((emailChanged || passwordChanging) && !currentPassword) {
      setError(t("profile.passwordRequired"));
      return;
    }
    setBusy(true);
    try {
      await updateProfile({
        name,
        email,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      setCurrentPassword("");
      setNewPassword("");
      toast.success(t("profile.saved"));
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : "Request failed"));
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto(file?: File) {
    if (!file) return;
    setPhotoError("");
    try {
      await setAvatar(await fitPhoto(file));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setPhotoError(message === "read" ? t("profile.photoReadError") : translateError(message));
    }
  }

  async function clearPhoto() {
    setPhotoError("");
    try {
      await setAvatar(null);
    } catch (err) {
      setPhotoError(translateError(err instanceof Error ? err.message : "Request failed"));
    }
  }

  return (
    <PageContainer>
      <PageHeader title={t("profile.title")} description={t("profile.description")} />
      <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
        <section className="rounded-xl border bg-card p-5">
          <div
            className="grid h-16 w-16 place-items-center overflow-hidden rounded-full text-lg font-semibold"
            style={user.avatar ? undefined : personTint(user.name || user.id)}
            aria-hidden="true"
          >
            {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : initials(user.name)}
          </div>
          <label className="mt-4 block text-sm font-medium">
            {t("profile.changePhoto")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={t("profile.photo")}
              className="mt-1 block w-full text-sm font-normal"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void pickPhoto(file);
              }}
            />
          </label>
          {user.avatar ? (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void clearPhoto()}>
              {t("profile.removePhoto")}
            </Button>
          ) : null}
          {photoError ? <p className="mt-2 text-sm text-destructive" role="alert">{photoError}</p> : null}
          <h2 className="mt-4 text-lg font-semibold">{user.name}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-3 text-sm">{user.role === "admin" ? t("profile.roleAdmin") : t("profile.roleMember")}</p>
          {user.createdAt ? (
            <p className="text-sm text-muted-foreground">{t("profile.since", { date: formatWhen(user.createdAt, "MMM d, yyyy") })}</p>
          ) : null}
        </section>

        <form onSubmit={(event) => void save(event)} className="rounded-xl border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">{t("common.name")}</Label>
              <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">{t("common.email")}</Label>
              <Input id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-current">{t("profile.currentPassword")}</Label>
              <Input
                id="profile-current"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                aria-describedby="profile-password-help"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-new">{t("profile.newPassword")}</Label>
              <Input
                id="profile-new"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={newPassword ? 8 : undefined}
                aria-describedby="profile-password-help"
              />
            </div>
          </div>
          <p id="profile-password-help" className="mt-3 text-sm text-muted-foreground">{t("profile.newPasswordHelp")}</p>
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={busy}>{busy ? t("common.saving") : t("common.save")}</Button>
          </div>
        </form>
      </div>

      <section className="mt-8 rounded-xl border bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">{t("profile.workspace")}</h2>
          {user.role === "admin" && (
            <Link to="/admin" className="text-sm font-medium text-primary hover:underline">{t("profile.people")}</Link>
          )}
        </div>
        {viewingOther ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("profile.viewingOther")}</p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-display font-semibold tabular-nums">{openTasks}</div>
              <div className="text-sm text-muted-foreground">{t("profile.openTasks")}</div>
            </div>
            <div>
              <div className="text-2xl font-display font-semibold tabular-nums">{overdue}</div>
              <div className="text-sm text-muted-foreground">{t("profile.overdue")}</div>
            </div>
            <div>
              <div className="text-2xl font-display font-semibold tabular-nums">{focusToday}</div>
              <div className="text-sm text-muted-foreground">{t("profile.focusToday")}</div>
            </div>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
