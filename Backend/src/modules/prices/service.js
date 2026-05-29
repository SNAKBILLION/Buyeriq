import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";

class PricesService extends BaseRepository {
  constructor() {
    super("price_data", ["product_id","source_name","price_type","marketplace"]);
  }

  async getByIdentifier(identifier) {
    const record = await this.findById(identifier);
    if (!record) throw ApiError.notFound("Prices not found");
    return record;
  }
}

export default new PricesService();
