import { Router } from "express";
import {
  createFAQ,
  deleteFAQ,
  getAllfaq,
  getFaqById,
  updateFAQ,
} from "../../controllers/faqController";
import verifyToken from "../../middlewares/auth-middleware";

const faqRouter = Router();

faqRouter.post("/create_faq", verifyToken, createFAQ);
faqRouter.put("/update_faq/:id", verifyToken, updateFAQ);
faqRouter.get("/faq", getAllfaq);
faqRouter.get("/faq/:id", getFaqById);
faqRouter.delete("/delete_faq/:id", verifyToken, deleteFAQ);

export default faqRouter;
