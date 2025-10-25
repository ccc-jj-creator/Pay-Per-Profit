
export enum Outcome {
  PENDING = 'PENDING',
  WIN = 'WIN',
  LOSS = 'LOSS',
}

export interface Signal {
  id: string;
  creatorId: string;
  content: string;
  price: number;
  timestamp: number;
  commitHash: string;
  outcome: Outcome;
}

export enum UserRole {
  CREATOR = 'CREATOR',
  BUYER = 'BUYER',
}

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  role: UserRole;
  credits: number;
}

export interface Purchase {
  id: string;
  userId: string;
  signalId: string;
  pricePaid: number;
  timestamp: number;
}

export enum BuyerSegment {
  NEVER_PURCHASED = 'Never Purchased',
  TRIED_AND_CREDITED = 'Tried & Credited',
  RECENT_WINS = 'Recent Wins',
  HIGH_LTV = 'High LTV',
}
