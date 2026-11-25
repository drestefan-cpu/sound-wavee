import { Users, Heart, Play, Send, Smile, Flame, Disc3, UserPlus, BookOpen, Library, Sparkle, Bell, Link2, Settings, Smartphone } from "lucide-react";
import type { TipStep } from "@/components/PageTip";

/** The words in each page's first-visit tip. Keep each step to one or two short sentences. */

export const FRIENDS_TIPS: TipStep[] = [
  {
    icon: Users,
    title: "your friends' music",
    body: "When a friend likes a song on Spotify, Apple Music, Tidal or YouTube Music, it shows up here by itself.",
  },
  {
    icon: Heart,
    title: "on every song",
    body: (
      <>
        <Heart className="inline h-3 w-3 align-[-1px]" /> saves it to your finds,{" "}
        <Play className="inline h-3 w-3 align-[-1px]" /> plays it in your music app,{" "}
        <Send className="inline h-3 w-3 align-[-1px]" /> sends it to a friend. Tap a song for details and a 30-second preview.
      </>
    ),
  },
  {
    icon: Smile,
    title: "react",
    body: "Tap an emoji under a friend's song to react. They'll get a notification.",
  },
];

export const DISCOVER_TIPS: TipStep[] = [
  {
    icon: Flame,
    title: "trending",
    body: "The songs people on PLAI are loving this week, plus the top songs chart.",
  },
  {
    icon: Disc3,
    title: "releases",
    body: "New music from artists you follow. You follow an artist automatically when you save or send one of their songs.",
  },
  {
    icon: UserPlus,
    title: "people",
    body: "People with taste like yours. Follow them to see their music in your friends feed.",
  },
  {
    icon: BookOpen,
    title: "journal",
    body: "Picks, playlists and stories from PLAI.",
  },
];

export const LIBRARY_TIPS: TipStep[] = [
  {
    icon: Library,
    title: "collection",
    body: "The songs you like in your music app, synced to PLAI. This is what friends see in their feed.",
  },
  {
    icon: Heart,
    title: "finds",
    body: "Songs from friends: ones you saved with the heart, ones sent to you (reply with an emoji), and ones you sent.",
  },
  {
    icon: Users,
    title: "friends",
    body: "The people you follow, with your taste match. Tap someone's match on their profile to see what you share.",
  },
  {
    icon: Bell,
    title: "activity",
    body: "Who saved or reacted to your songs, and how often your shared links were opened.",
  },
];

export const SETTINGS_TIPS: TipStep[] = [
  {
    icon: Link2,
    title: "connect your music",
    body: "Connect the app you listen on so your likes show up for friends. You can connect more than one.",
  },
  {
    icon: Settings,
    title: "your music app",
    body: "Choose which app opens when you tap play. Every song opens on that app, whatever app it came from.",
  },
  {
    icon: Smartphone,
    title: "share from anywhere",
    body: "On iPhone, add the Share with PLAI shortcut to turn any song link into a PLAI link from your music app's share button.",
  },
];
