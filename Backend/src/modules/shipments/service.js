import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";

class ShipmentsService extends BaseRepository {
  constructor() {
    super("shipment_records", ["buyer_id","supplier_id","hs_code","origin_country","dest_country"]);
  }

  async getByIdentifier(identifier) {
    const record = await this.findById(identifier);
    if (!record) throw ApiError.notFound("Shipments not found");
    return record;
  }
}

export default new ShipmentsService();
