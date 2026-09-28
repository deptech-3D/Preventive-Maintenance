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
    user_id: "usr_1790247088279_m4t7",
    name: "Bambang Supriyanto",
    email: "deptech",
    role: "admin",
    property_name: "Midtown Hotel Samarinda",
    password_hash: "736073",
    deleted: false,
    created_at: "2026-09-24T10:51:28.279Z",
  },
  {
    user_id: "usr_1790247291509_su5a",
    name: "Bambang Supriyanto",
    email: "deptech user",
    role: "user",
    property_name: "Midtown Hotel Samarinda",
    password_hash: "736073",
    deleted: false,
    created_at: "2026-09-24T10:54:51.509Z",
  },
  {
    user_id: "usr_1790512514869_jtiv",
    name: "Kholil",
    email: "kholildewi878@gmail.com",
    role: "user",
    property_name: "Midtown Hotel Samarinda",
    password_hash: "240252",
    deleted: false,
    created_at: "2026-09-27T12:35:14.869Z",
  },
  {
    user_id: "usr_1790512527634_s4hr",
    name: "Aliansyah",
    email: "alikasubia83@gmail.com",
    role: "user",
    property_name: "Midtown Hotel Samarinda",
    password_hash: "414687",
    deleted: false,
    created_at: "2026-09-27T12:35:27.634Z",
  },
  {
    user_id: "usr_1790512554376_tcf5",
    name: "Anwar",
    email: "muhanmja1404@gmail.com",
    role: "user",
    property_name: "Midtown Hotel Samarinda",
    password_hash: "930987",
    deleted: false,
    created_at: "2026-09-27T12:35:54.376Z",
  },
  {
    user_id: "usr_1790512597031_6zej",
    name: "Nanang",
    email: "aknanang@gmail.com",
    role: "user",
    property_name: "Midtown Hotel Samarinda",
    password_hash: "260249",
    deleted: false,
    created_at: "2026-09-27T12:36:37.031Z",
  },
  {
    user_id: "usr_1790512626333_09nj",
    name: "Andi Pratama",
    email: "prtmaandi77@gmail.com",
    role: "user",
    property_name: "Midtown Hotel Samarinda",
    password_hash: "199200",
    deleted: false,
    created_at: "2026-09-27T12:37:06.333Z",
  },
  {
    user_id: "usr_1790512663377_nl2m",
    name: "Edi Sunarto",
    email: "edisunarto2702@gmail.com",
    role: "user",
    property_name: "Midtown Hotel Samarinda",
    password_hash: "850226",
    deleted: false,
    created_at: "2026-09-27T12:37:43.377Z",
  },
  {
    user_id: "usr_1790512702759_46jz",
    name: "Heriadi",
    email: "admineng",
    role: "admin",
    property_name: "Midtown Hotel Samarinda",
    password_hash: "848797",
    deleted: false,
    created_at: "2026-09-27T12:38:22.759Z",
  },
];
