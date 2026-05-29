import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";

class ComplianceService extends BaseRepository {
  constructor() {
    super("compliance_rules", ["country_scope","status"]);
  }

  async getByIdentifier(identifier) {
    const record = identifier.match(/^[0-9a-f-]{36}$/) ? await this.findById(identifier) : await this.findBySlug(identifier);
    if (!record) throw ApiError.notFound("Compliance not found");
    return record;
  }
}

export default new ComplianceService();
