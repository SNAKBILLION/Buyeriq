import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";

class AlertsService extends BaseRepository {
  constructor() {
    super("alerts", ["buyer_id","type","urgency","status"]);
  }

  async getByIdentifier(identifier) {
    const record = await this.findById(identifier);
    if (!record) throw ApiError.notFound("Alerts not found");
    return record;
  }
}

export default new AlertsService();
