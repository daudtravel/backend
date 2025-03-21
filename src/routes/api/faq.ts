import { Router } from "express";
import { createFAQ, deleteFAQ, getAllfaq, getFaqById, updateFAQ } from "../../handlers/faq";
 
const faqRouter = Router();

faqRouter.post("/create_faq",  createFAQ);
faqRouter.put("/update_faq/:id",  updateFAQ);
faqRouter.get("/faq",  getAllfaq);
faqRouter.get("/faq/:id",  getFaqById);
faqRouter.delete("/delete_faq/:id",  deleteFAQ);
 


export default faqRouter;