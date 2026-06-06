import { Controller, Get, Post, Body, Param, UseGuards, Request, Put, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiResponse } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { CreateServiceDto } from './dtos/create-service.dto'; // Import Service DTO
import { UpdateServiceDto } from './dtos/update-service.dto'; // Import Service DTO
import { CreateReviewDto } from './dtos/create-review.dto';
import { CheckoutDto } from './dtos/checkout.dto'; // Import Checkout DTO

@ApiTags('MOD-BIZ: Kết nối doanh nghiệp & Sản phẩm & Dịch vụ & Giao dịch')
@Controller('business')
export class BusinessController {
  constructor(private readonly bizService: BusinessService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả hồ sơ doanh nghiệp liên kết' })
  async getProfiles() {
    return this.bizService.getAllProfiles();
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết hồ sơ doanh nghiệp' })
  async getProfile(@Param('id') id: string) {
    return this.bizService.getCompanyProfile(id);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo mới hoặc cập nhật thông tin hồ sơ doanh nghiệp' })
  async createOrUpdate(@Request() req: any, @Body() data: any) {
    return this.bizService.createOrUpdateProfile(req.user.id, data);
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xác minh hồ sơ doanh nghiệp liên kết (Dành cho Quản trị viên)' })
  async verify(@Param('id') id: string) {
    return this.bizService.verifyProfile(id);
  }

  // --- Product Management Endpoints ---

  @Post(':businessProfileId/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo sản phẩm mới cho hồ sơ doanh nghiệp' })
  @ApiParam({ name: 'businessProfileId', description: 'ID của hồ sơ doanh nghiệp' })
  @ApiBody({ type: CreateProductDto })
  async createProduct(
    @Request() req: any,
    @Param('businessProfileId') businessProfileId: string,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.bizService.createProduct(req.user.id, businessProfileId, createProductDto);
  }

  @Get(':businessProfileId/products')
  @ApiOperation({ summary: 'Lấy danh sách tất cả sản phẩm của một hồ sơ doanh nghiệp' })
  @ApiParam({ name: 'businessProfileId', description: 'ID của hồ sơ doanh nghiệp' })
  async findAllProductsByBusinessProfile(
    @Param('businessProfileId') businessProfileId: string,
  ) {
    return this.bizService.findAllProducts(businessProfileId);
  }

  @Get('products/:productId')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết sản phẩm theo ID' })
  @ApiParam({ name: 'productId', description: 'ID của sản phẩm' })
  async findProductById(
    @Param('productId') productId: string,
  ) {
    return this.bizService.findProductById(productId);
  }

  @Put(':businessProfileId/products/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin sản phẩm' })
  @ApiParam({ name: 'businessProfileId', description: 'ID của hồ sơ doanh nghiệp' })
  @ApiParam({ name: 'productId', description: 'ID của sản phẩm' })
  @ApiBody({ type: UpdateProductDto })
  async updateProduct(
    @Request() req: any,
    @Param('businessProfileId') businessProfileId: string,
    @Param('productId') productId: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.bizService.updateProduct(req.user.id, productId, updateProductDto);
  }

  @Delete(':businessProfileId/products/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa sản phẩm' })
  @ApiParam({ name: 'businessProfileId', description: 'ID của hồ sơ doanh nghiệp' })
  @ApiParam({ name: 'productId', description: 'ID của sản phẩm' })
  async deleteProduct(
    @Request() req: any,
    @Param('businessProfileId') businessProfileId: string,
    @Param('productId') productId: string,
  ) {
    return this.bizService.deleteProduct(req.user.id, productId);
  }

  // --- Service Management Endpoints ---

  @Post(':businessProfileId/services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo dịch vụ mới cho hồ sơ doanh nghiệp' })
  @ApiParam({ name: 'businessProfileId', description: 'ID của hồ sơ doanh nghiệp' })
  @ApiBody({ type: CreateServiceDto })
  async createService(
    @Request() req: any,
    @Param('businessProfileId') businessProfileId: string,
    @Body() createServiceDto: CreateServiceDto,
  ) {
    return this.bizService.createService(req.user.id, businessProfileId, createServiceDto);
  }

  @Get(':businessProfileId/services')
  @ApiOperation({ summary: 'Lấy danh sách tất cả dịch vụ của một hồ sơ doanh nghiệp' })
  @ApiParam({ name: 'businessProfileId', description: 'ID của hồ sơ doanh nghiệp' })
  async findAllServicesByBusinessProfile(
    @Param('businessProfileId') businessProfileId: string,
  ) {
    return this.bizService.findAllServices(businessProfileId);
  }

  @Get('services/:serviceId')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết dịch vụ theo ID' })
  @ApiParam({ name: 'serviceId', description: 'ID của dịch vụ' })
  async findServiceById(
    @Param('serviceId') serviceId: string,
  ) {
    return this.bizService.findServiceById(serviceId);
  }

  @Put(':businessProfileId/services/:serviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin dịch vụ' })
  @ApiParam({ name: 'businessProfileId', description: 'ID của hồ sơ doanh nghiệp' })
  @ApiParam({ name: 'serviceId', description: 'ID của dịch vụ' })
  @ApiBody({ type: UpdateServiceDto })
  async updateService(
    @Request() req: any,
    @Param('businessProfileId') businessProfileId: string,
    @Param('serviceId') serviceId: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.bizService.updateService(req.user.id, serviceId, updateServiceDto);
  }

  @Delete(':businessProfileId/services/:serviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa dịch vụ' })
  @ApiParam({ name: 'businessProfileId', description: 'ID của hồ sơ doanh nghiệp' })
  @ApiParam({ name: 'serviceId', description: 'ID của dịch vụ' })
  async deleteService(
    @Request() req: any,
    @Param('businessProfileId') businessProfileId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.bizService.deleteService(req.user.id, serviceId);
  }

  // --- Review Endpoints ---

  @Post('products/:productId/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh giá sản phẩm' })
  @ApiParam({ name: 'productId', description: 'ID của sản phẩm' })
  @ApiBody({ type: CreateReviewDto })
  async createProductReview(
    @Request() req: any,
    @Param('productId') productId: string,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.bizService.createReview(req.user.id, productId, 'product', createReviewDto);
  }

  @Get('products/:productId/reviews')
  @ApiOperation({ summary: 'Lấy danh sách đánh giá của sản phẩm' })
  @ApiParam({ name: 'productId', description: 'ID của sản phẩm' })
  async getProductReviews(@Param('productId') productId: string) {
    return this.bizService.getReviewsByItem(productId, 'product');
  }

  @Post('services/:serviceId/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh giá dịch vụ' })
  @ApiParam({ name: 'serviceId', description: 'ID của dịch vụ' })
  @ApiBody({ type: CreateReviewDto })
  async createServiceReview(
    @Request() req: any,
    @Param('serviceId') serviceId: string,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.bizService.createReview(req.user.id, serviceId, 'service', createReviewDto);
  }

  @Get('services/:serviceId/reviews')
  @ApiOperation({ summary: 'Lấy danh sách đánh giá của dịch vụ' })
  @ApiParam({ name: 'serviceId', description: 'ID của dịch vụ' })
  async getServiceReviews(@Param('serviceId') serviceId: string) {
    return this.bizService.getReviewsByItem(serviceId, 'service');
  }

  // --- Cart & Checkout Endpoints ---

  @Get('cart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy nội dung giỏ hàng của người dùng' })
  async getCart(@Request() req: any) {
    return this.bizService.getCart(req.user.id);
  }

  @Post('cart/add')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm sản phẩm hoặc dịch vụ vào giỏ hàng' })
  async addToCart(
    @Request() req: any,
    @Body() data: { itemId: string; itemType: 'product' | 'service'; quantity?: number },
  ) {
    return this.bizService.addToCart(req.user.id, data.itemId, data.itemType, data.quantity);
  }

  @Delete('cart/:cartItemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa một mục khỏi giỏ hàng' })
  async removeFromCart(@Request() req: any, @Param('cartItemId') cartItemId: string) {
    return this.bizService.removeFromCart(req.user.id, cartItemId);
  }

  @Delete('cart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa toàn bộ giỏ hàng' })
  async clearCart(@Request() req: any) {
    return this.bizService.clearCart(req.user.id);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thực hiện thanh toán và tạo đơn hàng' })
  @ApiBody({ type: CheckoutDto })
  async checkout(@Request() req: any, @Body() checkoutDto: CheckoutDto) {
    return this.bizService.checkout(req.user.id, checkoutDto);
  }

  @Get('orders/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy lịch sử đơn hàng của tôi' })
  async getMyOrders(@Request() req: any) {
    return this.bizService.getMyOrders(req.user.id);
  }

  @Get('orders/vendor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách các mục đơn hàng dành cho doanh nghiệp' })
  async getVendorOrders(@Request() req: any) {
    return this.bizService.getVendorOrders(req.user.id);
  }
}
