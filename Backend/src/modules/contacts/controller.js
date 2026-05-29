import service from "./service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parsePagination, paginatedResponse } from "../../utils/pagination.js";

export const getAll = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const filters = req.query;
  const { data, total } = await service.findAll(filters, pagination);
  res.json({ success: true, ...paginatedResponse(data, total, pagination) });
});

export const getOne = asyncHandler(async (req, res) => {
  const record = await service.getByIdentifier(req.params.id);
  res.json({ success: true, data: record });
});

export const create = asyncHandler(async (req, res) => {
  const record = await service.create(req.body);
  res.status(201).json({ success: true, data: record });
});

export const update = asyncHandler(async (req, res) => {
  const record = await service.update(req.params.id, req.body);
  if (!record) throw (await import("../../utils/ApiError.js")).ApiError.notFound();
  res.json({ success: true, data: record });
});

export const remove = asyncHandler(async (req, res) => {
  await service.delete(req.params.id);
  res.json({ success: true, message: "Deleted" });
});
