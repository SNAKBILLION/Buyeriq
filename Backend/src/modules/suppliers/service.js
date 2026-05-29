import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";

class SuppliersService extends BaseRepository {
  constructor() {
    super("suppliers", ["country_code","cluster","is_active","is_competitor"]);
  }

  async getByIdentifier(identifier) {
    const record = await this.findById(identifier);
    if (!record) throw ApiError.notFound("Suppliers not found");
    return record;
  }
}

export default new SuppliersService();
