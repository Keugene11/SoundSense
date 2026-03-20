"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Profile, UserPreferences } from "@/types/database";

interface SettingsClientProps {
  profile: Profile;
  preferences: UserPreferences | null;
}

export function SettingsClient({
  profile,
  preferences,
}: SettingsClientProps) {
  const [prefs, setPrefs] = useState({
    favorite_genres: preferences?.favorite_genres?.join(", ") || "",
    mood: preferences?.mood || "balanced",
    discovery_level: preferences?.discovery_level ?? 50,
    exclude_artists: preferences?.exclude_artists?.join(", ") || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favorite_genres: prefs.favorite_genres
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean),
          mood: prefs.mood,
          discovery_level: prefs.discovery_level,
          exclude_artists: prefs.exclude_artists
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Tabs defaultValue="preferences">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="youtube">YouTube Music</TabsTrigger>
        </TabsList>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Music Preferences</CardTitle>
              <CardDescription>
                Customize how AI generates your recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Favorite Genres (comma-separated)</Label>
                <Input
                  value={prefs.favorite_genres}
                  onChange={(e) =>
                    setPrefs({ ...prefs, favorite_genres: e.target.value })
                  }
                  placeholder="pop, indie, electronic, hip-hop"
                />
              </div>

              <div className="space-y-2">
                <Label>Mood</Label>
                <Select
                  value={prefs.mood}
                  onValueChange={(v) => setPrefs({ ...prefs, mood: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="energetic">Energetic</SelectItem>
                    <SelectItem value="chill">Chill</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="melancholic">Melancholic</SelectItem>
                    <SelectItem value="upbeat">Upbeat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  Discovery Level: {prefs.discovery_level}%
                </Label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={prefs.discovery_level}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      discovery_level: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Familiar</span>
                  <span>Adventurous</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Exclude Artists (comma-separated)</Label>
                <Input
                  value={prefs.exclude_artists}
                  onChange={(e) =>
                    setPrefs({ ...prefs, exclude_artists: e.target.value })
                  }
                  placeholder="Artist 1, Artist 2"
                />
              </div>

              <Button onClick={handleSavePreferences} disabled={saving}>
                {saving ? "Saving..." : "Save Preferences"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* YouTube Music Tab */}
        <TabsContent value="youtube">
          <Card>
            <CardHeader>
              <CardTitle>YouTube Music</CardTitle>
              <CardDescription>Manage your YouTube Music connection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <span>Status:</span>
                <Badge
                  variant={
                    profile.youtube_music_connected ? "default" : "secondary"
                  }
                >
                  {profile.youtube_music_connected
                    ? "Connected"
                    : "Not connected"}
                </Badge>
              </div>
              <Button variant="outline" asChild>
                <a href="/connect">
                  {profile.youtube_music_connected
                    ? "Reconnect"
                    : "Connect YouTube Music"}
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
