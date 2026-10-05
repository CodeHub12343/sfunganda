import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "@/middleware/authMiddleware.js";
import { asyncHandler, auth } from "./_shared.js";
import { User } from "@/models/index.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const user = await User.findById(new mongoose.Types.ObjectId(a.actor.user_id)).lean();
    res.json({
      data: {
        user: user && {
          id: user._id.toString(),
          email: user.email,
          display_name: user.display_name,
          mfa_enrolled_at: user.mfa_enrolled_at,
        },
        session: {
          mfa_verified: a.actor.mfa_verified,
        },
        assignments: a.actor.assignments,
      },
    });
  })
);

export default router;
