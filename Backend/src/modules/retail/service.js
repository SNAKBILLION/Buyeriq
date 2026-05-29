import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";

class RetailService extends BaseRepository {
  constructor() {
    super("retail_product_data", ["marketplace","category","material","wood_type","brand"]);
  }

  async getByIdentifier(identifier) {
    const record = await this.findById(identifier);
    if (!record) throw ApiError.notFound("Retail not found");
    return record;
  }
}

export default new RetailService();
