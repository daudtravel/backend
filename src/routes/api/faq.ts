import { Router } from "express";
import { createFAQ, deleteFAQ, getAllFAQs, updateFAQ } from "../../handlers/faq";
 
const faqRouter = Router();

faqRouter.post("/create_questions",  createFAQ);
faqRouter.put("/update_faq",  updateFAQ);
faqRouter.get("/faq",  getAllFAQs);
faqRouter.get("/delete_faq",  deleteFAQ);
 


export default faqRouter;