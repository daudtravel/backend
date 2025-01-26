import { z } from "zod";

 

const CreateDriversSchema = z.object({
    firstname: z.string().min(1, "Name is required"),
    lastname: z.string().min(1, "Name is required"),
    image: z.string().regex(/^data:image\/[a-zA-Z]+;base64,/, "Invalid image format"),
  });
  
  export default CreateDriversSchema;