import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";

class HsCodesService extends BaseRepository {
  constructor() {
    super("hs_codes", ["chapter"]);
  }

  async getByIdentifier(identifier) {
    const record = await this.findById(identifier);
    if (!record) throw ApiError.notFound("HsCodes not found");
    return record;
  }
}

export default new HsCodesService();
