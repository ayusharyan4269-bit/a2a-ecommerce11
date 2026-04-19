/**
 * listings-store.ts
 * Prisma-based PostgreSQL store for service listings.
 */

import { PrismaClient } from "@prisma/client";

// Prevent multiple instances of PrismaClient in development
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export interface Listing {
  id: string;
  service: string;
  type: string;
  price: number;
  description: string;
  seller: string;   
  username?: string | null;
  password?: string | null;
  notes?: string | null;
  signature?: string | null;
  zkCommitment?: string | null;
  ipfsHash?: string | null;  // IPFS CID — ties the listing item to the seller's wallet permanently
  timestamp: number;
  createdAt: string;
}

export async function getAllListings(filters?: {
  type?: string;
  maxPrice?: number;
  seller?: string;  
}): Promise<Omit<Listing, "username" | "password">[]> {
  const where: any = {};
  
  if (filters?.type) {
    where.type = filters.type;
  }
  if (filters?.maxPrice !== undefined) {
    where.price = { lte: filters.maxPrice };
  }
  if (filters?.seller) {
    // Case-insensitive Prisma query for text
    where.seller = { equals: filters.seller, mode: 'insensitive' };
  }

  const listings = await prisma.listing.findMany({
    where,
    orderBy: { timestamp: "desc" },
  });

  // Return newest first, strip only sensitive credentials
  return listings.map(({ username: _u, password: _p, ...safe }) => safe);
}

export async function createListing(data: Omit<Listing, "id" | "createdAt">): Promise<Listing> {
  const listing = await prisma.listing.create({
    data: {
      ...data,
      createdAt: new Date().toISOString(),
    },
  });
  return listing;
}

export async function getListingById(id: string): Promise<Listing | null> {
  const listing = await prisma.listing.findUnique({
    where: { id }
  });
  return listing;
}

export async function deleteListingById(id: string): Promise<boolean> {
  try {
    await prisma.listing.delete({
      where: { id }
    });
    return true;
  } catch {
    return false;
  }
}
