import { BaseRepository } from "../../utils/BaseRepository.js";
import { ApiError } from "../../utils/ApiError.js";

class ContactsService extends BaseRepository {
  constructor() {
    super("contacts", ["company_id","buyer_id","supplier_id"]);
  }

  async getByIdentifier(identifier) {
    const record = await this.findById(identifier);
    if (!record) throw ApiError.notFound("Contacts not found");
    return record;
  }
}

export default new ContactsService();
