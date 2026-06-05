import { Injectable, NotFoundException, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BusinessProfile } from './entities/business.entity';
import { Product } from './entities/product.entity';
import { Service } from './entities/service.entity';
import { Review } from './entities/review.entity';
import { CartItem } from './entities/cart-item.entity';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Transaction, PaymentMethod, TransactionStatus } from './entities/transaction.entity';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { CreateServiceDto } from './dtos/create-service.dto';
import { UpdateServiceDto } from './dtos/update-service.dto';
import { CreateReviewDto } from './dtos/create-review.dto';
import { CheckoutDto } from './dtos/checkout.dto';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(BusinessProfile) private readonly bizRepo: Repository<BusinessProfile>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Service) private readonly serviceRepo: Repository<Service>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(CartItem) private readonly cartRepo: Repository<CartItem>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Transaction) private readonly transactionRepo: Repository<Transaction>,
    private readonly dataSource: DataSource, // Inject DataSource for transactions
  ) {}

  /**
   * Tạo mới hoặc cập nhật hồ sơ doanh nghiệp (MOD-11)
   */
  async createOrUpdateProfile(userId: string, data: any) {
    let profile = await this.bizRepo.findOne({ where: { user_id: userId } });

    if (profile) {
      // Cập nhật
      profile.name = data.name || profile.name;
      profile.description = data.description || profile.description;
      profile.industry = data.industry || profile.industry;
      profile.website = data.website || profile.website;
      profile.logo_url = data.logo_url || profile.logo_url;
      return this.bizRepo.save(profile);
    } else {
      // Tạo mới
      const newProfile = this.bizRepo.create({
        ...data,
        user_id: userId,
        is_verified: false,
      });
      return this.bizRepo.save(newProfile);
    }
  }

  /**
   * F-11: Lấy chi tiết hồ sơ doanh nghiệp & các gói tài trợ
   */
  async getCompanyProfile(companyId: string) {
    const profile = await this.bizRepo.findOne({
      where: { id: companyId },
      relations: ['products', 'services'], // Load products and services
    });
    if (!profile) throw new NotFoundException('Doanh nghiệp không tồn tại');

    return {
      profile,
      active_sponsorships: [
        'Nhà tài trợ vàng cuộc thi EduMap Hackathon 2026',
        'Tài trợ thiết bị tin học phòng Lab trường THPT Chuyên',
        'Tài trợ 20 suất học bổng xanh Green Campus'
      ],
      rating: 4.9,
    };
  }

  /**
   * Lấy danh sách tất cả các doanh nghiệp kết nối
   */
  async getAllProfiles() {
    return this.bizRepo.find({
      order: { created_at: 'DESC' },
      relations: ['products', 'services'], // Load relations
    });
  }

  /**
   * Xác minh hồ sơ doanh nghiệp (Dành cho Admin)
   */
  async verifyProfile(companyId: string) {
    const profile = await this.bizRepo.findOne({ where: { id: companyId } });
    if (!profile) throw new NotFoundException('Doanh nghiệp không tồn tại');

    profile.is_verified = true;
    return this.bizRepo.save(profile);
  }

  // --- Product Management Methods ---

  async createProduct(userId: string, businessProfileId: string, createProductDto: CreateProductDto) {
    const businessProfile = await this.bizRepo.findOne({
      where: { id: businessProfileId, user_id: userId },
    });
    if (!businessProfile) {
      throw new UnauthorizedException('Bạn không có quyền tạo sản phẩm cho hồ sơ doanh nghiệp này hoặc hồ sơ không tồn tại.');
    }

    const product = this.productRepo.create({
      ...createProductDto,
      businessProfileId: businessProfile.id,
    });
    return this.productRepo.save(product);
  }

  async findAllProducts(businessProfileId?: string) {
    const whereCondition = businessProfileId ? { businessProfileId } : {};
    return this.productRepo.find({
      where: whereCondition,
      relations: ['reviews', 'reviews.user'],
    });
  }

  async findProductById(productId: string) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['reviews', 'reviews.user', 'businessProfile'],
    });
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại.');
    }
    return product;
  }

  async updateProduct(userId: string, productId: string, updateProductDto: UpdateProductDto) {
    const product = await this.productRepo.findOne({ where: { id: productId }, relations: ['businessProfile'] });
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại.');
    }
    if (product.businessProfile.user_id !== userId) {
      throw new UnauthorizedException('Bạn không có quyền cập nhật sản phẩm này.');
    }

    // Update product fields from DTO
    Object.assign(product, updateProductDto);
    return this.productRepo.save(product);
  }

  async deleteProduct(userId: string, productId: string) {
    const product = await this.productRepo.findOne({ where: { id: productId }, relations: ['businessProfile'] });
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại.');
    }
    if (product.businessProfile.user_id !== userId) {
      throw new UnauthorizedException('Bạn không có quyền xóa sản phẩm này.');
    }

    await this.productRepo.delete(productId);
    return { message: 'Sản phẩm đã được xóa thành công.' };
  }

  // --- Service Management Methods ---

  async createService(userId: string, businessProfileId: string, createServiceDto: CreateServiceDto) {
    const businessProfile = await this.bizRepo.findOne({
      where: { id: businessProfileId, user_id: userId },
    });
    if (!businessProfile) {
      throw new UnauthorizedException('Bạn không có quyền tạo dịch vụ cho hồ sơ doanh nghiệp này hoặc hồ sơ không tồn tại.');
    }

    const service = this.serviceRepo.create({
      ...createServiceDto,
      businessProfileId: businessProfile.id,
    });
    return this.serviceRepo.save(service);
  }

  async findAllServices(businessProfileId?: string) {
    const whereCondition = businessProfileId ? { businessProfileId } : {};
    return this.serviceRepo.find({
      where: whereCondition,
      relations: ['reviews', 'reviews.user'],
    });
  }

  async findServiceById(serviceId: string) {
    const service = await this.serviceRepo.findOne({
      where: { id: serviceId },
      relations: ['reviews', 'reviews.user', 'businessProfile'],
    });
    if (!service) {
      throw new NotFoundException('Dịch vụ không tồn tại.');
    }
    return service;
  }

  async updateService(userId: string, serviceId: string, updateServiceDto: UpdateServiceDto) {
    const service = await this.serviceRepo.findOne({ where: { id: serviceId }, relations: ['businessProfile'] });
    if (!service) {
      throw new NotFoundException('Dịch vụ không tồn tại.');
    }
    if (service.businessProfile.user_id !== userId) {
      throw new UnauthorizedException('Bạn không có quyền cập nhật dịch vụ này.');
    }

    Object.assign(service, updateServiceDto);
    return this.serviceRepo.save(service);
  }

  async deleteService(userId: string, serviceId: string) {
    const service = await this.serviceRepo.findOne({ where: { id: serviceId }, relations: ['businessProfile'] });
    if (!service) {
      throw new NotFoundException('Dịch vụ không tồn tại.');
    }
    if (service.businessProfile.user_id !== userId) {
      throw new UnauthorizedException('Bạn không có quyền xóa dịch vụ này.');
    }

    await this.serviceRepo.delete(serviceId);
    return { message: 'Dịch vụ đã được xóa thành công.' };
  }

  // --- Review Management Methods ---

  async createReview(userId: string, itemId: string, itemType: 'product' | 'service', createReviewDto: CreateReviewDto) {
    // Check if user has already reviewed this item
    const existingReview = await this.reviewRepo.findOne({
      where: {
        user_id: userId,
        ...(itemType === 'product' ? { productId: itemId } : { serviceId: itemId }),
      },
    });

    if (existingReview) {
      throw new ConflictException('Bạn đã gửi đánh giá cho mục này rồi.');
    }

    const review = this.reviewRepo.create({
      ...createReviewDto,
      user_id: userId,
    });

    if (itemType === 'product') {
      const product = await this.productRepo.findOne({ where: { id: itemId } });
      if (!product) throw new NotFoundException('Sản phẩm không tồn tại.');
      review.productId = itemId;
    } else {
      const service = await this.serviceRepo.findOne({ where: { id: itemId } });
      if (!service) throw new NotFoundException('Dịch vụ không tồn tại.');
      review.serviceId = itemId;
    }

    return this.reviewRepo.save(review);
  }

  async getReviewsByItem(itemId: string, itemType: 'product' | 'service') {
    const whereCondition = itemType === 'product' ? { productId: itemId } : { serviceId: itemId };
    return this.reviewRepo.find({
      where: whereCondition,
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  // --- Cart Management Methods ---

  async addToCart(userId: string, itemId: string, itemType: 'product' | 'service', quantity: number = 1) {
    let cartItem = await this.cartRepo.findOne({
      where: {
        userId,
        ...(itemType === 'product' ? { productId: itemId } : { serviceId: itemId }),
      },
    });

    if (cartItem) {
      cartItem.quantity += quantity;
    } else {
      cartItem = this.cartRepo.create({
        userId,
        quantity,
        ...(itemType === 'product' ? { productId: itemId } : { serviceId: itemId }),
      });
    }

    return this.cartRepo.save(cartItem);
  }

  async getCart(userId: string) {
    return this.cartRepo.find({
      where: { userId },
      relations: ['product', 'service'],
    });
  }

  async removeFromCart(userId: string, cartItemId: string) {
    const item = await this.cartRepo.findOne({ where: { id: cartItemId, userId } });
    if (!item) throw new NotFoundException('Mục trong giỏ hàng không tồn tại.');
    return this.cartRepo.remove(item);
  }

  async clearCart(userId: string) {
    await this.cartRepo.delete({ userId });
    return { message: 'Giỏ hàng đã được xóa.' };
  }

  // --- Checkout Logic (Transactional) ---

  async checkout(userId: string, checkoutDto: CheckoutDto) {
    const cartItems = await this.getCart(userId);
    if (cartItems.length === 0) {
      throw new BadRequestException('Giỏ hàng trống.');
    }

    // Use a transaction for safety
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let totalAmount = 0;
      const orderItems: OrderItem[] = [];

      // 1. Validate items and stock, calculate total
      for (const item of cartItems) {
        let price = 0;
        if (item.product) {
          if (item.product.stock < item.quantity) {
            throw new BadRequestException(`Sản phẩm ${item.product.name} không đủ tồn kho.`);
          }
          price = Number(item.product.price);
          // Update stock
          item.product.stock -= item.quantity;
          await queryRunner.manager.save(item.product);
        } else if (item.service) {
          price = Number(item.service.price);
        }

        totalAmount += price * item.quantity;

        const orderItem = queryRunner.manager.create(OrderItem, {
          productId: item.productId,
          serviceId: item.serviceId,
          quantity: item.quantity,
          priceAtPurchase: price,
        });
        orderItems.push(orderItem);
      }

      // 2. Create Order
      const order = queryRunner.manager.create(Order, {
        userId,
        totalAmount,
        shippingAddress: checkoutDto.shippingAddress,
        status: OrderStatus.PENDING,
      });
      const savedOrder = await queryRunner.manager.save(order);

      // 3. Link items to order and save
      for (const orderItem of orderItems) {
        orderItem.orderId = savedOrder.id;
        await queryRunner.manager.save(orderItem);
      }

      // 4. Create Transaction
      const transaction = queryRunner.manager.create(Transaction, {
        orderId: savedOrder.id,
        paymentMethod: checkoutDto.paymentMethod,
        amount: totalAmount,
        status: TransactionStatus.PENDING,
      });
      await queryRunner.manager.save(transaction);

      // 5. Clear Cart
      await queryRunner.manager.delete(CartItem, { userId });

      await queryRunner.commitTransaction();

      return {
        message: 'Đặt hàng thành công.',
        orderId: savedOrder.id,
        totalAmount,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getMyOrders(userId: string) {
    return this.orderRepo.find({
      where: { userId },
      relations: ['items', 'items.product', 'items.service'],
      order: { created_at: 'DESC' },
    });
  }

  async getVendorOrders(userId: string) {
    // This is more complex: orders containing products/services owned by this vendor
    const profile = await this.bizRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new UnauthorizedException('Chỉ dành cho doanh nghiệp.');

    // Find order items linked to this vendor's profile
    // Simplification: load all order items that belong to products/services of this vendor
    return this.orderItemRepo.find({
      where: [
        { product: { businessProfileId: profile.id } },
        { service: { businessProfileId: profile.id } },
      ],
      relations: ['order', 'order.user', 'product', 'service'],
      order: { created_at: 'DESC' },
    });
  }
}
