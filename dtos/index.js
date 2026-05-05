/**
 * Exportación centralizada de todos los DTOs
 */
const { UserDTO, CreateUserDTO, UpdateUserDTO } = require('./UserDTO');
const { ApartmentDTO, CreateApartmentDTO, UpdateApartmentDTO } = require('./ApartmentDTO');
const { ReviewDTO, CreateReviewDTO, UpdateReviewDTO } = require('./ReviewDTO');
const { ContractDTO, CreateContractDTO, UpdateContractDTO } = require('./ContractDTO');
const { NotificationDTO, CreateNotificationDTO, UpdateNotificationDTO } = require('./NotificationDTO');
const { LoginDTO, RefreshTokenDTO, LogoutDTO } = require('./AuthDTO');

module.exports = {
    UserDTO,
    CreateUserDTO,
    UpdateUserDTO,
    ApartmentDTO,
    CreateApartmentDTO,
    UpdateApartmentDTO,
    ReviewDTO,
    CreateReviewDTO,
    UpdateReviewDTO,
    ContractDTO,
    CreateContractDTO,
    UpdateContractDTO,
    NotificationDTO,
    CreateNotificationDTO,
    UpdateNotificationDTO,
    LoginDTO,
    RefreshTokenDTO,
    LogoutDTO
};
