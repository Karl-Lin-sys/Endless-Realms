export type Role = "user" | "model";

export interface StoryBeat {
  id: string;
  role: Role;
  text: string;
  imagePrompt?: string;
  imageUrl?: string;
  isLoadingImage?: boolean;
}

export interface GameState {
  inventory: string[];
  quest: string;
}

export type ImageSize = "1K" | "2K" | "4K";
