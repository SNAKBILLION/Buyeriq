import service from "./service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parsePagination, paginatedResponse } from "../../utils/pagination.js";

// Self-registration disabled — invite only
export const register = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, error: { message: "Self-registration is disabled. Ask your admin for an invite." } });
});

export const login = asyncHandler(async (req, res) => {
  const result = await service.login(req.body.email, req.body.password);
  res.json({ success: true, data: result });
});

export const getProfile = asyncHandler(async (req, res) => {
  // Update last_login on every profile fetch (called on page load)
  try {
    const { query } = await import('../../config/database.js');
    await query('UPDATE users SET last_login = NOW() WHERE email = $1', [req.user.email]);
  } catch(_) {}
  if (!req.user?.email) {
    return res.json({ success: true, data: null });
  }
  const profile = await service.getProfile(req.user.email);
  res.json({ success: true, data: profile });
});

export const getAll = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { data, total } = await service.findAll(req.query, pagination);
  const safe = data.map(({ password_hash, ...u }) => u);
  res.json({ success: true, ...paginatedResponse(safe, total, pagination) });
});

// Admin: Invite new user
export const invite = asyncHandler(async (req, res) => {
  const result = await service.inviteUser(req.body, req.user.email);
  res.status(201).json({ success: true, data: result });
});

// Admin: Change user role
export const updateRole = asyncHandler(async (req, res) => {
  const result = await service.updateRole(req.params.id, req.body.role);
  const { password_hash, ...safe } = result;
  res.json({ success: true, data: safe });
});

// Admin: Block/Unblock user
export const toggleActive = asyncHandler(async (req, res) => {
  const result = await service.toggleActive(req.params.id);
  const { password_hash, ...safe } = result;
  res.json({ success: true, data: safe });
});

// Admin: Delete user
export const remove = asyncHandler(async (req, res) => {
  await service.deleteUser(req.params.id);
  res.json({ success: true, message: "User deleted" });
});
