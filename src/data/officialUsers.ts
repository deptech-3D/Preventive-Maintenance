import { User } from "../types";

export interface StoredUserRecord extends User {
  password_hash?: string;
  deleted?: boolean;
}

export interface UserBackupPackage {
  version: string;
  exported_at: string;
  property_name: string;
  admin: {
    name: string;
    email: string;
    custom_password?: string;
  };
  users: StoredUserRecord[];
  deleted_user_ids: string[];
}

export const OFFICIAL_USER_BACKUP_VERSION = "v2_midtown_hotel_users_embedded";

export const OFFICIAL_ADMIN_CONFIG = {
  user_id: "usr_admin_midtown",
  name: "Chief Engineer (Admin)",
  email: "engmidtownhotelsmd@gmail.com",
  default_passwords: ["admin", "123engsmd", "123456", "midtown"],
  property_name: "Midtown Hotel Samarinda",
};

export const OFFICIAL_USERS_LIST: StoredUserRecord[] = [
  {
    user_id: "usr_admin_midtown",
    name: "Chief Engineer",
    email: "engmidtownhotelsmd@gmail.com",
    role: "admin",
    property_name: "Midtown Hotel Samarinda",
    password_hash: "123engsmd",
    deleted: false,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    user_id: "usr_technician_1",
    name: "Teknisi Engineering",
    email: "teknisi@midtown.local",
    role: "user",
    property_name: "Midtown Hotel Samarinda",
    password_hash: "123456",
    deleted: false,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];
