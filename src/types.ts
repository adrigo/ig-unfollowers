export interface UserNode {
  id: string;
  username: string;
  fullName: string;
  profilePicUrl: string;
  isPrivate: boolean;
  isVerified: boolean;
  followsViewer: boolean;
}

export interface CacheData {
  timestamp: number;
  users: UserNode[];
}

