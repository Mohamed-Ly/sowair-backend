const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");
const bcrypt = require("bcryptjs");

// ================= Controllers =================

// GET /api/users - جميع المستخدمين (للأدمن فقط)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;

    const where = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    // 🔥 الحل المؤقت: بدون _count
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        // 🔥 مؤقتاً: إزالة _count لحل المشكلة
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    });

    const total = await prisma.user.count({ where });

    return sendSuccess(
      res,
      {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
      200
    );
  } catch (error) {
    console.error("❌ خطأ في getAllUsers:", error);
    return sendError(res, error.message, 500);
  }
};

// GET /api/users/:id - بيانات مستخدم معين (عام)
exports.getSingleUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return sendFail(res, { message: "المستخدم غير موجود" }, 404);
    }

    return sendSuccess(res, { user }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// PUT /api/users/:id - تحديث بيانات المستخدم (موحد للأدمن والمستخدم)
exports.updateUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, email, phone, password, role } = req.body;

    // التحقق من وجود المستخدم
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return sendFail(res, { message: "المستخدم غير موجود" }, 404);
    }

    // التحقق من الصلاحيات: المستخدم يمكنه تعديل نفسه فقط، الأدمن يمكنه تعديل أي مستخدم
    const currentUserId = req.user.sub;
    const currentUserRole = req.user.role;

    if (currentUserRole !== "ADMIN" && userId !== currentUserId) {
      return sendFail(res, { message: "غير مصرح بتعديل هذا المستخدم" }, 403);
    }

    // التحقق من عدم تكرار البريد الإلكتروني
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });
      if (emailExists) {
        return sendFail(
          res,
          { message: "البريد الإلكتروني مستخدم بالفعل" },
          400
        );
      }
    }

    // التحقق من عدم تكرار رقم الهاتف
    if (phone && phone !== existingUser.phone) {
      const phoneExists = await prisma.user.findUnique({
        where: { phone },
      });
      if (phoneExists) {
        return sendFail(res, { message: "رقم الهاتف مستخدم بالفعل" }, 400);
      }
    }

    // بناء بيانات التحديث
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;

    // تحديث كلمة المرور إذا تم إرسالها
    if (password) {
      // 🔐 التحقق من كلمة المرور الحالية أولاً
      if (!req.body.currentPassword) {
        return sendFail(
          res,
          { message: "يرجى إدخال كلمة المرور الحالية" },
          400
        );
      }

      // التحقق من صحة كلمة المرور الحالية
      const isCurrentPasswordValid = await bcrypt.compare(
        req.body.currentPassword,
        existingUser.password
      );

      if (!isCurrentPasswordValid) {
        return sendFail(res, { message: "كلمة المرور الحالية غير صحيحة" }, 400);
      }

      // إذا كانت كلمة المرور الحالية صحيحة، نحدث الكلمة الجديدة
      if (password.length < 8) {
        return sendFail(
          res,
          { message: "كلمة المرور يجب ألا تقل عن 8 أحرف" },
          400
        );
      }
      updateData.password = await bcrypt.hash(password, 12);
    }

    // if (password) {
    //   if (password.length < 8) {
    //     return sendFail(
    //       res,
    //       { message: "كلمة المرور يجب ألا تقل عن 8 أحرف" },
    //       400
    //     );
    //   }
    //   updateData.password = await bcrypt.hash(password, 12);
    // }

    // فقط الأدمن يمكنه تغيير الدور
    if (role && currentUserRole === "ADMIN") {
      updateData.role = role;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return sendSuccess(
      res,
      {
        user: updatedUser,
        message: "تم تحديث بيانات المستخدم بنجاح",
      },
      200
    );
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// PATCH /api/users/admin/:id/role - تغيير دور مستخدم (أدمن فقط)
exports.updateUserRole = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { role } = req.body;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return sendFail(res, { message: "المستخدم غير موجود" }, 404);

    if (existing.id === req.user.sub) {
      return sendFail(res, { message: "لا يمكنك تغيير دورك الخاص" }, 400);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return sendSuccess(res, { user }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// GET /api/users/count - عداد المستخدمين (للأدمن فقط)
exports.getUsersCount = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const customersCount = await prisma.user.count({
      where: { role: "CUSTOMER" },
    });
    const adminsCount = await prisma.user.count({ where: { role: "ADMIN" } });
    const deliveriesCount = await prisma.user.count({
      where: { role: "DELIVERY" },
    });

    return sendSuccess(
      res,
      {
        counts: {
          total: totalUsers,
          customers: customersCount,
          admins: adminsCount,
          deliveries: deliveriesCount,
        },
      },
      200
    );
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// DELETE /api/users/:id - حذف مستخدم (موحد مع تحقق الصلاحيات)
exports.deleteUser = async (req, res) => {
  const txn = await prisma.$transaction(async (prisma) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUserId = req.user.sub;
      const currentUserRole = req.user.role;

      // التحقق من وجود المستخدم
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return sendFail(res, { message: "المستخدم غير موجود" }, 404);
      }

      // - المستخدم يمكنه حذف حسابه الشخصي فقط
      // - الأدمن يمكنه حذف أي مستخدم
      if (currentUserRole !== "ADMIN" && userId !== currentUserId) {
        return sendFail(res, { message: "غير مصرح بحذف هذا المستخدم" }, 403);
      }

      // حذف البيانات المرتبطة
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.notification.deleteMany({ where: { userId } });

      // حذف السلة وعناصرها
      const cart = await prisma.cart.findUnique({ where: { userId } });
      if (cart) {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
        await prisma.cart.delete({ where: { userId } });
      }

      // حذف المفضلة وعناصرها
      const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
      if (wishlist) {
        await prisma.wishlistItem.deleteMany({
          where: { wishlistId: wishlist.id },
        });
        await prisma.wishlist.delete({ where: { userId } });
      }

      // حذف الطلبات وعناصرها
      const orders = await prisma.order.findMany({ where: { userId } });
      for (const order of orders) {
        await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      }
      await prisma.order.deleteMany({ where: { userId } });

      // أخيراً حذف المستخدم
      await prisma.user.delete({
        where: { id: userId },
      });

      // 🔥 إضافة: رسالة مختلفة حسب من قام بالحذف
      const message =
        userId === currentUserId
          ? "تم حذف حسابك الشخصي وجميع بياناتك بنجاح"
          : "تم حذف المستخدم وجميع بياناته بنجاح";

      return sendSuccess(
        res,
        {
          message: message,
        },
        200
      );
    } catch (error) {
      throw error;
    }
  });
};
