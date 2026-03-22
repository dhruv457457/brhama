import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = resolve(__dirname, "../../permissions.json");

export interface StoredPermission {
  id: string;
  walletAddress: string;
  repoName: string;
  budget: string;
  periodDays: string;
  expiryDays: string;
  agentAddress: string;
  permissionsContext: string;
  delegationManager: string;
  createdAt: string;
  expiresAt: string;
  status: "active" | "revoked" | "expired";
}

interface PermissionStore {
  permissions: StoredPermission[];
}

function readStore(): PermissionStore {
  if (!existsSync(STORE_PATH)) {
    return { permissions: [] };
  }
  try {
    const raw = readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { permissions: [] };
  }
}

function writeStore(store: PermissionStore): void {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Save a new permission (or update existing one for same wallet+repo).
 */
export function savePermission(permission: Omit<StoredPermission, "id" | "createdAt" | "status">): StoredPermission {
  const store = readStore();

  // Check for existing active permission for same wallet + repo
  const existingIdx = store.permissions.findIndex(
    (p) =>
      p.walletAddress.toLowerCase() === permission.walletAddress.toLowerCase() &&
      p.repoName === permission.repoName &&
      p.status === "active"
  );

  const entry: StoredPermission = {
    ...permission,
    id: existingIdx >= 0 ? store.permissions[existingIdx].id : `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: existingIdx >= 0 ? store.permissions[existingIdx].createdAt : new Date().toISOString(),
    status: "active",
  };

  if (existingIdx >= 0) {
    // Update existing
    store.permissions[existingIdx] = entry;
    console.log(`[PermissionStore] Updated permission ${entry.id} for ${permission.repoName}`);
  } else {
    // Add new
    store.permissions.push(entry);
    console.log(`[PermissionStore] Saved new permission ${entry.id} for ${permission.repoName}`);
  }

  writeStore(store);
  return entry;
}

/**
 * Get all permissions for a wallet address.
 */
export function getPermissions(walletAddress: string): StoredPermission[] {
  const store = readStore();

  // Auto-expire old permissions
  const now = new Date();
  let changed = false;
  store.permissions.forEach((p) => {
    if (p.status === "active" && new Date(p.expiresAt) < now) {
      p.status = "expired";
      changed = true;
    }
  });
  if (changed) writeStore(store);

  return store.permissions.filter(
    (p) => p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
}

/**
 * Get the active permission for a wallet (most recent active one).
 */
export function getActivePermission(walletAddress: string): StoredPermission | null {
  const perms = getPermissions(walletAddress);
  return perms.find((p) => p.status === "active") || null;
}

/**
 * Revoke a permission by ID.
 */
export function revokeStoredPermission(permissionId: string): boolean {
  const store = readStore();
  const perm = store.permissions.find((p) => p.id === permissionId);
  if (!perm) return false;

  perm.status = "revoked";
  writeStore(store);
  console.log(`[PermissionStore] Revoked permission ${permissionId}`);
  return true;
}
