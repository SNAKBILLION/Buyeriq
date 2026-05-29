import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";
import config from "../../config/index.js";

class UserService extends BaseRepository {
  constructor() { super("users", ["role", "is_active"]); }

  // ── Invite-Only Registration (admin creates users) ──
  async inviteUser(data, invitedBy) {
    const existing = await this.findByEmail(data.email);
    if (existing) throw ApiError.conflict("Email already registered");

    // Generate temporary password (user will login via Supabase)
    const tempPassword = crypto.randomBytes(16).toString("hex");
    const hash = await bcrypt.hash(tempPassword, 12);

    const user = await this.create({
      name: data.name,
      email: data.email,
      password_hash: hash,
      role: data.role || "viewer",
      is_active: true,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      invited_by: invitedBy,
      note: "User must be created in Supabase Auth separately with same email",
    };
  }

  // ── Legacy register (disabled — invite only) ──
  async register(data) {
    throw ApiError.forbidden("Self-registration is disabled. Ask your admin for an invite.");
  }

  // ── Login (legacy JWT — Supabase is primary) ──
  async login(email, password) {
    const user = await this.findByEmail(email);
    if (!user) throw ApiError.unauthorized("Invalid credentials");
    if (!user.is_active) throw ApiError.forbidden("Account is deactivated. Contact admin.");
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw ApiError.unauthorized("Invalid credentials");
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    // Update last_login
    const { query } = await import("../../config/database.js");
    await query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  }

  // ── Update Role ──
  async updateRole(userId, newRole) {
    const validRoles = ["admin", "manager", "sales", "production", "viewer"];
    if (!validRoles.includes(newRole)) throw ApiError.badRequest(`Invalid role: ${newRole}. Must be one of: ${validRoles.join(", ")}`);
    const user = await this.findById(userId);
    if (!user) throw ApiError.notFound("User not found");
    return this.update(userId, { role: newRole });
  }

  // ── Block / Unblock ──
  async toggleActive(userId) {
    const user = await this.findById(userId);
    if (!user) throw ApiError.notFound("User not found");
    return this.update(userId, { is_active: !user.is_active });
  }

  // ── Delete User ──
  async deleteUser(userId) {
    const user = await this.findById(userId);
    if (!user) throw ApiError.notFound("User not found");
    if (user.role === "admin") {
      // Count admins — don't delete last admin
      const { query } = await import("../../config/database.js");
      const res = await query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = true");
      if (parseInt(res.rows[0].count, 10) <= 1) throw ApiError.badRequest("Cannot delete the last admin");
    }
    return this.delete(userId);
  }

  // ── Get Profile (for /me endpoint) ──
  async getProfile(email) {
    const user = await this.findByEmail(email);
    if (!user) throw ApiError.notFound("User not found");
    return { id: user.id, name: user.name, email: user.email, role: user.role, is_active: user.is_active, last_login: user.last_login, created_at: user.created_at };
  }

  async findByEmail(email) {
    const { query } = await import("../../config/database.js");
    const res = await query("SELECT * FROM users WHERE email = $1", [email]);
    return res.rows[0] || null;
  }
}

export default new UserService();
