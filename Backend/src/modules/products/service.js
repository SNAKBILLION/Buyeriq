import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";

class ProductsService extends BaseRepository {
  constructor() {
    super("products", ["hs_code","category"]);
  }

  async getByIdentifier(identifier) {
    const record = identifier.match(/^[0-9a-f-]{36}$/) ? await this.findById(identifier) : await this.findBySlug(identifier);
    if (!record) throw ApiError.notFound("Products not found");
    return record;
  }
}

export default new ProductsService();
