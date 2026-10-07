export const API_BASE_URL = 'https://gp-autos.onrender.com';

export const API_TIMEOUT_MS = 15000;

export type AuthUser = {
	id: string;
	email: string;
	name: string;
	avatar_url: string | null;
};

export type SignInRequest = {
	email: string;
	password: string;
};

export type SignUpRequest = {
	name: string;
	email: string;
	password: string;
	confirm_password: string;
};

export type VehicleListing = {
	id: string;
	title: string;
	slug: string;
	make: string;
	model: string;
	year: number;
	mileage: number;
	condition: string;
	transmission: string;
	fuel_type: string;
	body_type: string;
	location: string;
	description: string;
	price: string;
	currency: string;
	image_url: string;
	stock: number;
	status: string;
	created_at: string;
};

export type CartItemCreate = {
	vehicle_listing_id: string;
	quantity: 1;
};

export type CartVehicle = Pick<
	VehicleListing,
	'id' | 'title' | 'slug' | 'make' | 'model' | 'year' | 'mileage' | 'location' | 'price' | 'currency' | 'image_url'
>;

export type CartItem = {
	id: string;
	vehicle_listing_id: string;
	quantity: number;
	created_at: string;
	vehicle_listing: CartVehicle;
};

export type OrderItemRequest = {
	vehicle_listing_id: string;
	quantity: number;
};

export type OrderCreateRequest = {
	items: OrderItemRequest[];
};

export type OrderRead = {
	id: string;
	status: string;
	currency: string;
	total: string;
	customer_email: string;
	payment_status: string;
	confirmation_email_sent_at: string | null;
	created_at: string;
};

export type PaymentInitializeResponse = {
	authorization_url: string;
	reference: string;
};

export type PaymentVerifyResponse = {
	order_id: string;
	order_status: string;
	payment_status: string;
};

export class ApiError extends Error {
	constructor(
		public readonly status: number | null,
		message: string,
		public readonly method: string,
		public readonly path: string,
		public readonly responseDetail: string | null = null,
	) {
		super(message);
		this.name = 'ApiError';
	}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const method = init.method ?? 'GET';
	let response: Response;

	try {
		response = await fetch(`${API_BASE_URL}${path}`, {
			...init,
			credentials: 'include',
			headers: {
				Accept: 'application/json',
				...(init.body ? { 'Content-Type': 'application/json' } : {}),
				...init.headers,
			},
		});
	} catch {
		const message = 'Unable to connect to the GP Autos API. Check your internet connection and try again.';
		if (__DEV__) console.warn(`[API] ${method} ${path} failed before receiving an HTTP response: network error`);
		throw new ApiError(null, message, method, path);
	}

	if (!response.ok) {
		const responseText = await response.text().catch(() => '');
		let responseDetail: string | null = null;
		if (responseText) {
			try {
				const payload: unknown = JSON.parse(responseText);
				if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
					const detail = payload.detail;
					responseDetail = typeof detail === 'string' ? detail : JSON.stringify(detail);
				} else {
					responseDetail = responseText;
				}
			} catch {
				responseDetail = responseText;
			}
		}
		responseDetail = responseDetail?.slice(0, 500) ?? null;
		if (__DEV__) {
			console.warn(
				`[API] ${method} ${path} returned HTTP ${response.status}${responseDetail ? `: ${responseDetail}` : ''}`,
			);
		}
		throw new ApiError(
			response.status,
			`HTTP ${response.status} from ${method} ${path}${responseDetail ? `: ${responseDetail}` : ''}`,
			method,
			path,
			responseDetail,
		);
	}

	if (response.status === 204) return undefined as T;

	try {
		return (await response.json()) as T;
	} catch {
		throw new ApiError(
			response.status,
			`The server returned an invalid response for ${method} ${path}.`,
			method,
			path,
		);
	}
}

export const authApi = {
	googleSignInUrl(): string {
		return `${API_BASE_URL}/auth/google`;
	},

	signIn(payload: SignInRequest): Promise<AuthUser> {
		return request<AuthUser>('/auth/login', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	},

	signUp(payload: SignUpRequest): Promise<AuthUser> {
		return request<AuthUser>('/auth/register', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	},

	getCurrentUser(): Promise<AuthUser> {
		return request<AuthUser>('/auth/me', { method: 'GET' });
	},

	logout(): Promise<void> {
		return request<void>('/auth/logout', { method: 'POST' });
	},
};

export const vehicleApi = {
	getVehicles(): Promise<VehicleListing[]> {
		return request<VehicleListing[]>('/api/vehicles', { method: 'GET' });
	},
};

export const cartApi = {
	getCart(): Promise<CartItem[]> {
		return request<CartItem[]>('/api/cart', { method: 'GET' });
	},

	addCartItem(vehicleListingId: string): Promise<CartItem> {
		const payload: CartItemCreate = { vehicle_listing_id: vehicleListingId, quantity: 1 };
		return request<CartItem>('/api/cart/items', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	},

	removeCartItem(vehicleListingId: string): Promise<void> {
		return request<void>(`/api/cart/items/${encodeURIComponent(vehicleListingId)}`, {
			method: 'DELETE',
		});
	},

	clearCart(): Promise<void> {
		return request<void>('/api/cart', { method: 'DELETE' });
	},
};

export const orderApi = {
	createOrder(payload: OrderCreateRequest): Promise<OrderRead> {
		return request<OrderRead>('/api/orders', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	},

	getOrders(): Promise<OrderRead[]> {
		return request<OrderRead[]>('/api/orders', { method: 'GET' });
	},
};

export const paymentApi = {
	initialize(orderId: string): Promise<PaymentInitializeResponse> {
		return request<PaymentInitializeResponse>('/api/payments/initialize', {
			method: 'POST',
			body: JSON.stringify({ order_id: orderId }),
		});
	},

	verify(reference: string): Promise<PaymentVerifyResponse> {
		return request<PaymentVerifyResponse>(`/api/payments/verify/${encodeURIComponent(reference)}`, {
			method: 'GET',
		});
	},
};
