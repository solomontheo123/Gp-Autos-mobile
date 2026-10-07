import { useEffect, useState, type ComponentProps } from 'react';
import {
	ActivityIndicator,
	AppState,
	Image,
	Linking,
	Modal,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';

import {
	ApiError,
	cartApi,
	orderApi,
	paymentApi,
	vehicleApi,
	type CartItem,
	type VehicleListing,
} from '../config/api';
import { useAuth } from '../auth/AuthProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildWhatsAppUrl, GP_AUTOS_WHATSAPP_NUMBER } from '../config/brand';

type Tab = 'home' | 'vehicles' | 'cart' | 'account';
type SortMode = 'recent' | 'price-low' | 'price-high' | 'year-new';
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const colors = {
	background: '#0b0c10',
	surface: '#1f2833',
	border: '#2f3e46',
	accent: '#66fcf1',
	text: '#ffffff',
	muted: '#c5c6c7',
	danger: '#ff9c9c',
};

function userInitials(name: string | undefined, email: string | undefined): string {
	const firstName = name?.trim().split(/\s+/)[0];
	if (firstName) return firstName.slice(0, 1).toUpperCase();
	return email?.trim().slice(0, 1).toUpperCase() || '?';
}

function messageFor(error: unknown): string {
	if (error instanceof ApiError && error.status === 401) {
		return 'Your session has expired. Sign in again to access your cart.';
	}
	if (error instanceof ApiError && error.status === 403) {
		return 'GP Autos denied this request. Check that your account has permission to access the cart.';
	}
	if (error instanceof ApiError && error.status === 404) {
		return 'The requested cart or vehicle resource was not found.';
	}
	if (error instanceof ApiError && error.status === 409) {
		return 'This vehicle is no longer available. Refresh the vehicle list and try another listing.';
	}
	if (error instanceof ApiError && error.status === 422) {
		return 'The API rejected the cart request. Verify the vehicle ID and quantity.';
	}
	if (error instanceof ApiError && error.status !== null && error.status >= 500) {
		return `GP Autos API error: ${error.message}`;
	}
	if (error instanceof ApiError && error.status === null) return error.message;
	return 'Unable to load GP Autos right now. Check your connection and try again.';
}

function formatPrice(value: string, currency: string): string {
	const amount = Number(value);
	if (!Number.isFinite(amount)) return `${currency} ${value}`;
	return new Intl.NumberFormat('en-NG', {
		style: 'currency',
		currency,
		maximumFractionDigits: 0,
	}).format(amount);
}

function sortLabel(mode: SortMode): string {
	if (mode === 'price-low') return 'Price: low to high';
	if (mode === 'price-high') return 'Price: high to low';
	if (mode === 'year-new') return 'Newest year';
	return 'Recently listed';
}

export function AuthenticatedApp() {
	const { user, logout } = useAuth();
	const insets = useSafeAreaInsets();
	const [tab, setTab] = useState<Tab>('home');
	const [vehicles, setVehicles] = useState<VehicleListing[]>([]);
	const [vehiclesLoading, setVehiclesLoading] = useState(true);
	const [vehiclesError, setVehiclesError] = useState<string | null>(null);
	const [cart, setCart] = useState<CartItem[]>([]);
	const [cartLoading, setCartLoading] = useState(false);
	const [cartError, setCartError] = useState<string | null>(null);
	const [busyVehicleId, setBusyVehicleId] = useState<string | null>(null);
	const [cartBusy, setCartBusy] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [search, setSearch] = useState('');
	const [selectedMake, setSelectedMake] = useState('All');
	const [sortMode, setSortMode] = useState<SortMode>('recent');
	const [selectedVehicle, setSelectedVehicle] = useState<VehicleListing | null>(null);
	const [accountOpen, setAccountOpen] = useState(false);
	const [pendingPaymentReference, setPendingPaymentReference] = useState<string | null>(null);
	const [checkoutBusy, setCheckoutBusy] = useState(false);

	const loadVehicles = async () => {
		setVehiclesLoading(true);
		setVehiclesError(null);
		try {
			setVehicles(await vehicleApi.getVehicles());
		} catch (error: unknown) {
			setVehiclesError(messageFor(error));
		} finally {
			setVehiclesLoading(false);
		}
	};

	const loadCart = async () => {
		setCartLoading(true);
		setCartError(null);
		try {
			setCart(await cartApi.getCart());
		} catch (error: unknown) {
			setCartError(messageFor(error));
		} finally {
			setCartLoading(false);
		}
	};

	useEffect(() => {
		void loadVehicles();
		void loadCart();
	}, []);

	useEffect(() => {
		if (tab === 'cart') void loadCart();
	}, [tab]);

	useEffect(() => {
		const subscription = AppState.addEventListener('change', (nextState) => {
			if (nextState === 'active') void loadCart();
		});

		return () => subscription.remove();
	}, []);

	useEffect(() => {
		if (!notice) return;
		const timeout = setTimeout(() => setNotice(null), 3500);
		return () => clearTimeout(timeout);
	}, [notice]);

	const addVehicle = async (vehicle: VehicleListing): Promise<boolean> => {
		setBusyVehicleId(vehicle.id);
		setNotice(null);
		setVehiclesError(null);
		try {
			await cartApi.addCartItem(vehicle.id);
			const latestCart = await cartApi.getCart();
			setCart(latestCart);
			setNotice(`${vehicle.title} added to your cart.`);
			return true;
		} catch (error: unknown) {
			setVehiclesError(messageFor(error));
			return false;
		} finally {
			setBusyVehicleId(null);
		}
	};

	const removeVehicle = async (vehicleListingId: string) => {
		setBusyVehicleId(vehicleListingId);
		setCartError(null);
		try {
			await cartApi.removeCartItem(vehicleListingId);
			setCart(await cartApi.getCart());
		} catch (error: unknown) {
			setCartError(messageFor(error));
		} finally {
			setBusyVehicleId(null);
		}
	};

	const clearCart = async () => {
		setCartBusy(true);
		setCartError(null);
		try {
			await cartApi.clearCart();
			setCart(await cartApi.getCart());
		} catch (error: unknown) {
			setCartError(messageFor(error));
		} finally {
			setCartBusy(false);
		}
	};

	const verifyPendingPayment = async (reference: string) => {
		try {
			const result = await paymentApi.verify(reference);
			if (result.payment_status === 'success' || result.order_status === 'paid') {
				setPendingPaymentReference(null);
				setNotice('Payment confirmed. Your order is now paid.');
				await loadCart();
				return;
			}
			setNotice('Payment is still being checked. Please return to this screen after the browser flow finishes.');
		} catch (error: unknown) {
			if (error instanceof ApiError && error.status === 404) {
				setNotice('Payment reference was not found yet. Please try again in a moment.');
				return;
			}
			setNotice('We could not verify the payment yet. Please return here after completing the Paystack flow.');
		}
	};

	const checkoutCart = async () => {
		if (cart.length === 0) {
			setCartError('Add a vehicle before checkout.');
			return;
		}
		setCheckoutBusy(true);
		setCartError(null);
		try {
			let order: Awaited<ReturnType<typeof orderApi.createOrder>>;
			try {
				order = await orderApi.createOrder({
					items: cart.map((item) => ({
						vehicle_listing_id: item.vehicle_listing_id,
						quantity: item.quantity,
					})),
				});
			} catch (error: unknown) {
				if (!(error instanceof ApiError) || error.status !== 409) throw error;

				await Promise.all([loadVehicles(), loadCart()]);
				const detail = error.responseDetail;
				setCartError(
					detail
						? `${detail} Remove the unavailable vehicle from your cart or choose another vehicle, then try again.`
						: 'A vehicle in your cart is no longer available. Your cart and vehicle list were refreshed; remove the unavailable vehicle or choose another one, then try again.',
				);
				return;
			}
			const payment = await paymentApi.initialize(order.id);
			setPendingPaymentReference(payment.reference);
			setNotice('Paystack opened in your browser. Return here after payment to verify it.');
			await WebBrowser.openBrowserAsync(payment.authorization_url);
		} catch (error: unknown) {
			setCartError(messageFor(error));
		} finally {
			setCheckoutBusy(false);
		}
	};

	useEffect(() => {
		if (!pendingPaymentReference) return;
		const subscription = AppState.addEventListener('change', async (nextState) => {
			if (nextState === 'active') {
				await verifyPendingPayment(pendingPaymentReference);
			}
		});
		return () => subscription.remove();
	}, [pendingPaymentReference]);

	const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
	const cartSubtotal = cart.reduce((total, item) => total + Number(item.vehicle_listing.price) * item.quantity, 0);
	const openWhatsApp = async (message = 'Hello GP Autos, I would like to learn more about your vehicles.') => {
		try {
			await Linking.openURL(buildWhatsAppUrl(message));
		} catch {
			setNotice('WhatsApp could not be opened. Please try again.');
		}
	};
	const makes = ['All', ...Array.from(new Set(vehicles.map((vehicle) => vehicle.make))).sort()];
	const filteredVehicles = vehicles
		.filter((vehicle) => selectedMake === 'All' || vehicle.make === selectedMake)
		.filter((vehicle) => `${vehicle.title} ${vehicle.make} ${vehicle.model} ${vehicle.location}`.toLowerCase().includes(search.trim().toLowerCase()))
		.sort((left, right) => {
			if (sortMode === 'price-low') return Number(left.price) - Number(right.price);
			if (sortMode === 'price-high') return Number(right.price) - Number(left.price);
			if (sortMode === 'year-new') return right.year - left.year;
			return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
		});
	const openAccount = () => {
		setTab('account');
		setAccountOpen(true);
	};
	const openCart = () => {
		if (tab === 'cart') void loadCart();
		else setTab('cart');
	};

	return (
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.header}>
				<BrandMark />
				<View style={styles.headerActions}>
					<Pressable accessibilityRole="button" accessibilityLabel={`Cart, ${cartCount} items`} onPress={openCart} style={styles.headerIconButton}>
						<MaterialCommunityIcons name="cart-outline" size={23} color={colors.text} />
						{cartCount > 0 ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text></View> : null}
					</Pressable>
					<Pressable accessibilityRole="button" accessibilityLabel="Open account menu" onPress={openAccount} style={styles.avatarButton}>
						<Text style={styles.avatarText}>{userInitials(user?.name, user?.email)}</Text>
					</Pressable>
				</View>
			</View>
			{notice ? (
				<Pressable accessibilityRole="alert" accessibilityLabel={`${notice} Dismiss`} onPress={() => setNotice(null)} style={styles.noticeToast}>
					<MaterialCommunityIcons name="check-circle" size={20} color={colors.accent} />
					<Text numberOfLines={2} style={styles.noticeToastText}>{notice}</Text>
					<MaterialCommunityIcons name="close" size={17} color={colors.muted} />
				</Pressable>
			) : null}

			{tab === 'home' ? (
				<ScrollView contentContainerStyle={styles.content}>
					<View style={styles.hero}>
						<Image
							accessibilityLabel={vehicles[0]?.title ?? 'GP Autos vehicle'}
							source={vehicles[0] ? { uri: vehicles[0].image_url } : undefined}
							style={styles.heroImage}
						/>
						<View style={styles.heroShade} />
						<View style={styles.heroCopy}>
							<Text style={styles.heroEyebrow}>A BETTER WAY TO BUY YOUR NEXT CAR</Text>
							<Text style={styles.heroTitle}>A better drive starts here.</Text>
							<Text style={styles.heroDescription}>
								Thoughtfully selected vehicles. Clear details. A purchase you can feel good about.
							</Text>
							<Pressable accessibilityRole="button" onPress={() => setTab('vehicles')} style={styles.heroButton}>
								<Text style={styles.heroButtonText}>Browse vehicles</Text>
							</Pressable>
							<Pressable accessibilityRole="button" onPress={() => void openWhatsApp()} style={styles.heroSecondaryButton}>
								<MaterialCommunityIcons name="whatsapp" size={17} color={colors.accent} />
								<Text style={styles.heroSecondaryText}>Talk to GP Autos</Text>
							</Pressable>
						</View>
					</View>

					<View style={styles.sectionHeading}>
						<View>
							<Text style={styles.eyebrow}>A CONSIDERED COLLECTION</Text>
							<Text style={styles.sectionTitle}>Featured vehicles</Text>
						</View>
						<Pressable accessibilityRole="button" onPress={() => setTab('vehicles')}>
							<Text style={styles.textLink}>View inventory</Text>
						</Pressable>
					</View>
					{vehiclesError ? <ErrorState message={vehiclesError} onRetry={() => void loadVehicles()} /> : null}
					{vehiclesLoading ? <LoadingState label="Loading featured vehicles" /> : null}
					{!vehiclesLoading && vehicles.length === 0 && !vehiclesError ? (
						<EmptyState title="No vehicles available" message="Check back soon for new listings." />
					) : null}
					<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
						{vehicles.slice(0, 3).map((vehicle) => (
							<FeaturedVehicleCard key={vehicle.id} vehicle={vehicle} onOpen={() => setSelectedVehicle(vehicle)} />
						))}
					</ScrollView>

					<View style={styles.valueSection}>
						<Text style={styles.eyebrow}>CONFIDENCE COMES STANDARD</Text>
						<Text style={styles.sectionTitle}>Good cars. No guesswork.</Text>
						<Text style={styles.valueCopy}>Every listing gives you clear details, from mileage to condition.</Text>
						<Text style={styles.valueCopy}>Local vehicles, local context, and prices in naira.</Text>
					</View>

					<View style={styles.serviceSection}>
						<Text style={styles.eyebrow}>SERVICE & SUPPORT</Text>
						<Text style={styles.sectionTitle}>More than vehicles.</Text>
						<Text style={styles.serviceIntro}>Ask our team about parts, repairs, and servicing.</Text>
						<Pressable
							accessibilityRole="button"
							onPress={() => void openWhatsApp('Hello GP Autos, I would like to ask about vehicle parts.')}
							style={styles.serviceRow}
						>
							<View style={styles.serviceIcon}><MaterialCommunityIcons name="wrench-outline" size={21} color={colors.accent} /></View>
							<View style={styles.serviceCopy}>
								<Text style={styles.serviceTitle}>Vehicle parts</Text>
								<Text style={styles.serviceDescription}>Ask about parts for your vehicle</Text>
							</View>
							<MaterialCommunityIcons name="arrow-top-right" size={18} color={colors.accent} />
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={() => void openWhatsApp('Hello GP Autos, I would like to enquire about repairs or servicing.')}
							style={styles.serviceRow}
						>
							<View style={styles.serviceIcon}><MaterialCommunityIcons name="car-wrench" size={21} color={colors.accent} /></View>
							<View style={styles.serviceCopy}>
								<Text style={styles.serviceTitle}>Repairs & servicing</Text>
								<Text style={styles.serviceDescription}>Talk to us about service enquiries</Text>
							</View>
							<MaterialCommunityIcons name="arrow-top-right" size={18} color={colors.accent} />
						</Pressable>
					</View>

					<View style={styles.contactSection}>
						<Text style={styles.eyebrow}>TALK TO GP AUTOS</Text>
						<Text style={styles.contactTitle}>Abuja, Nigeria</Text>
						<Text style={styles.contactCopy}>Serving Abuja, Nigeria. Contact our team for vehicle enquiries and availability.</Text>
						<Text style={styles.contactCopy}>WhatsApp: +{GP_AUTOS_WHATSAPP_NUMBER.slice(0, 3)} {GP_AUTOS_WHATSAPP_NUMBER.slice(3, 6)} {GP_AUTOS_WHATSAPP_NUMBER.slice(6, 9)} {GP_AUTOS_WHATSAPP_NUMBER.slice(9)}</Text>
						<Pressable accessibilityRole="button" onPress={() => void openWhatsApp()} style={styles.contactButton}>
							<Text style={styles.contactButtonText}>Chat on WhatsApp</Text>
						</Pressable>
					</View>
				</ScrollView>
			) : null}

			{tab === 'vehicles' ? (
				<ScrollView contentContainerStyle={styles.content}>
					<Text style={styles.eyebrow}>THE COLLECTION</Text>
					<Text style={styles.pageTitle}>Find your next drive.</Text>
					<Text style={styles.intro}>Current vehicles, directly from GP Autos.</Text>
					<View style={styles.searchBox}>
						<MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
						<TextInput
							accessibilityLabel="Search vehicles"
							placeholder="Search make, model or location"
							placeholderTextColor={colors.muted}
							value={search}
							onChangeText={setSearch}
							style={styles.searchInput}
							returnKeyType="search"
						/>
					</View>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
						{makes.map((make) => (
							<Pressable key={make} onPress={() => setSelectedMake(make)} style={[styles.filterChip, selectedMake === make && styles.filterChipActive]}>
								<Text style={[styles.filterText, selectedMake === make && styles.filterTextActive]}>{make}</Text>
							</Pressable>
						))}
					</ScrollView>
					<View style={styles.resultsRow}>
						<Text style={styles.resultCount}>{filteredVehicles.length} vehicles</Text>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`Sort vehicles, currently ${sortMode.replace('-', ' ')}`}
							onPress={() => setSortMode((current) => current === 'recent' ? 'price-low' : current === 'price-low' ? 'price-high' : current === 'price-high' ? 'year-new' : 'recent')}
							style={styles.sortButton}
						>
							<MaterialCommunityIcons name="sort" size={17} color={colors.accent} />
							<Text style={styles.sortText}>{sortLabel(sortMode)}</Text>
						</Pressable>
					</View>
					{vehiclesError ? <ErrorState message={vehiclesError} onRetry={() => void loadVehicles()} /> : null}
					{vehiclesLoading ? <LoadingState label="Loading available vehicles" /> : null}
					{!vehiclesLoading && !vehiclesError && filteredVehicles.length === 0 ? (
						<EmptyState title="No matching vehicles" message="Try another search or make." />
					) : null}
					{filteredVehicles.map((vehicle) => (
						<VehicleCard
							key={vehicle.id}
							vehicle={vehicle}
							busy={busyVehicleId === vehicle.id}
							onAdd={() => void addVehicle(vehicle)}
							onOpen={() => setSelectedVehicle(vehicle)}
						/>
					))}
				</ScrollView>
			) : null}

			{tab === 'cart' ? (
				<ScrollView contentContainerStyle={styles.content}>
					<View style={styles.titleRow}>
						<View>
						<Text style={styles.eyebrow}>YOUR SELECTION</Text>
						<Text style={styles.pageTitle}>Cart ({cartCount})</Text>
					</View>
						<Pressable accessibilityRole="button" onPress={() => void loadCart()} style={styles.refreshButton}>
							<Text style={styles.refreshText}>Refresh</Text>
						</Pressable>
					</View>
					{cartError ? <ErrorState message={cartError} onRetry={() => void loadCart()} /> : null}
					{cartLoading ? <LoadingState label="Loading your server cart" /> : null}
					{!cartLoading && !cartError && cart.length === 0 ? (
						<View style={styles.messagePanel}>
							<MaterialCommunityIcons name="cart-outline" size={30} color={colors.accent} />
							<Text style={styles.emptyTitle}>Your cart is empty</Text>
							<Text style={styles.stateText}>Browse the collection and add a vehicle to begin.</Text>
							<Pressable accessibilityRole="button" onPress={() => setTab('vehicles')} style={styles.addButton}>
								<Text style={styles.addButtonText}>Browse vehicles</Text>
							</Pressable>
						</View>
					) : null}
					{cart.map((item) => (
						<CartCard
							key={item.id}
							item={item}
							busy={busyVehicleId === item.vehicle_listing_id}
							onRemove={() => void removeVehicle(item.vehicle_listing_id)}
						/>
					))}
					{cart.length > 0 ? (
						<View style={styles.cartSummary}>
							<View>
								<Text style={styles.summaryLabel}>Current listed total</Text>
								<Text style={styles.summaryAmount}>{formatPrice(String(cartSubtotal), cart[0]?.vehicle_listing.currency ?? 'NGN')}</Text>
							</View>
							<View style={styles.checkoutActions}>
								<Pressable
									accessibilityRole="button"
									disabled={cartBusy || cartLoading || checkoutBusy}
									onPress={() => void clearCart()}
									style={[styles.clearButton, (cartBusy || cartLoading || checkoutBusy) && styles.disabledButton]}
								>
									<MaterialCommunityIcons name="delete-outline" size={17} color={colors.danger} />
									<Text style={styles.clearButtonText}>{cartBusy ? 'Clearing…' : 'Clear cart'}</Text>
								</Pressable>
								<Pressable
									accessibilityRole="button"
									disabled={cartBusy || cartLoading || checkoutBusy}
									onPress={() => void checkoutCart()}
									style={[styles.checkoutButton, (cartBusy || cartLoading || checkoutBusy) && styles.disabledButton]}
								>
									<Text style={styles.checkoutButtonText}>{checkoutBusy ? 'Preparing…' : 'Checkout'}</Text>
								</Pressable>
							</View>
						</View>
					) : null}
				</ScrollView>
			) : null}

			{tab === 'account' ? (
				<View style={styles.accountLanding}>
					<Text style={styles.eyebrow}>YOUR GP AUTOS ACCOUNT</Text>
					<Text style={styles.pageTitle}>Account</Text>
					<Pressable style={styles.accountPreview} onPress={() => setAccountOpen(true)}>
						<Avatar name={user?.name} email={user?.email} large />
						<View style={styles.accountPreviewText}>
							<Text style={styles.accountName}>{user?.name}</Text>
							<Text style={styles.accountEmail}>{user?.email}</Text>
						</View>
						<MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
					</Pressable>
					<Pressable accessibilityRole="button" onPress={() => void loadCart().then(() => setTab('cart'))} style={styles.accountAction}>
						<MaterialCommunityIcons name="cart-outline" size={21} color={colors.accent} />
						<Text style={styles.accountActionText}>Your cart</Text>
						<MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
					</Pressable>
					<Pressable accessibilityRole="button" onPress={() => void openWhatsApp('Hello GP Autos, I would like help with a vehicle enquiry.')} style={styles.accountAction}>
						<MaterialCommunityIcons name="whatsapp" size={20} color={colors.accent} />
						<Text style={styles.accountActionText}>Contact support</Text>
						<MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
					</Pressable>
					<Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.logoutButton}>
						<Text style={styles.logoutText}>Sign out</Text>
					</Pressable>
				</View>
			) : null}

			<Modal visible={accountOpen} transparent animationType="slide" onRequestClose={() => { setAccountOpen(false); setTab('home'); }}>
				<View style={styles.modalRoot}>
					<Pressable accessibilityRole="button" accessibilityLabel="Close account menu" style={styles.modalScrim} onPress={() => { setAccountOpen(false); setTab('home'); }} />
					<View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
						<View style={styles.sheetHandle} />
						<View style={styles.sheetTopRow}>
							<Text style={styles.sheetTitle}>Your account</Text>
							<Pressable accessibilityRole="button" accessibilityLabel="Close account menu" onPress={() => { setAccountOpen(false); setTab('home'); }} style={styles.sheetClose}>
								<MaterialCommunityIcons name="close" size={21} color={colors.text} />
							</Pressable>
						</View>
						<View style={styles.accountSheetIdentity}>
							<Avatar name={user?.name} email={user?.email} large />
							<View style={styles.accountPreviewText}>
								<Text style={styles.accountName}>{user?.name}</Text>
								<Text style={styles.accountEmail}>{user?.email}</Text>
							</View>
						</View>
						<SheetAction icon="car-outline" label="Browse vehicles" onPress={() => { setAccountOpen(false); setTab('vehicles'); }} />
						<SheetAction icon="cart-outline" label={`Your cart${cartCount ? ` (${cartCount})` : ''}`} onPress={() => { setAccountOpen(false); setTab('cart'); void loadCart(); }} />
						<SheetAction icon="whatsapp" label="Contact GP Autos" onPress={() => void openWhatsApp('Hello GP Autos, I would like help with a vehicle enquiry.')} />
						<Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.sheetSignOut}>
							<MaterialCommunityIcons name="logout" size={19} color={colors.danger} />
							<Text style={styles.sheetSignOutText}>Sign out</Text>
						</Pressable>
					</View>
				</View>
			</Modal>

			<Modal visible={selectedVehicle !== null} transparent animationType="slide" onRequestClose={() => setSelectedVehicle(null)}>
				{selectedVehicle ? (
					<VehicleDetailsSheet
						vehicle={selectedVehicle}
						busy={busyVehicleId === selectedVehicle.id}
						bottomInset={insets.bottom}
						onClose={() => setSelectedVehicle(null)}
						onAdd={async () => {
							if (await addVehicle(selectedVehicle)) setSelectedVehicle(null);
						}}
						onContact={() => void openWhatsApp(`Hello GP Autos, I'm interested in the ${selectedVehicle.title}.`)}
					/>
				) : null}
			</Modal>

			<View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
				<TabButton icon="home-variant-outline" label="Home" active={tab === 'home'} onPress={() => setTab('home')} />
				<TabButton icon="car-outline" label="Vehicles" active={tab === 'vehicles'} onPress={() => setTab('vehicles')} />
				<TabButton
					icon="cart-outline"
					label={`Cart${cartCount ? ` (${cartCount})` : ''}`}
					active={tab === 'cart'}
					onPress={openCart}
				/>
				<TabButton icon="account-circle-outline" label="Account" active={accountOpen || tab === 'account'} onPress={openAccount} />
			</View>
		</SafeAreaView>
	);
}

function BrandMark() {
	return (
		<View style={styles.brandRow}>
			<Text style={styles.brandName}>GP<Text style={styles.brandAccent}>AUTOS</Text></Text>
		</View>
	);
}

function VehicleCard({ vehicle, busy, onAdd, onOpen }: { vehicle: VehicleListing; busy: boolean; onAdd: () => void; onOpen: () => void }) {
	return (
		<View style={styles.vehicleCard}>
			<Pressable accessibilityRole="button" accessibilityLabel={`View details for ${vehicle.title}`} onPress={onOpen}>
				<Image accessibilityLabel={vehicle.title} source={{ uri: vehicle.image_url }} style={styles.vehicleImage} />
			</Pressable>
			<View style={styles.vehicleDetails}>
				<Pressable accessibilityRole="button" onPress={onOpen}>
					<Text style={styles.vehicleTitle}>{vehicle.title}</Text>
				</Pressable>
				<Text style={styles.vehicleSpecs}>{vehicle.year}  ·  {vehicle.mileage.toLocaleString()} km  ·  {vehicle.condition}</Text>
					<Text style={styles.vehicleQuantity}>Quantity available: {vehicle.stock}</Text>
				<View style={styles.availabilityRow}>
					<View style={styles.availabilityDot} />
					<Text style={styles.vehicleLocation}>{vehicle.stock > 0 && vehicle.status === 'active' ? 'Available' : 'Currently unavailable'}  ·  {vehicle.location}</Text>
				</View>
				<View style={styles.vehicleActionRow}>
					<Text style={styles.price}>{formatPrice(vehicle.price, vehicle.currency)}</Text>
					<Pressable
						accessibilityRole="button"
						disabled={busy}
						onPress={onAdd}
						style={[styles.addButton, busy && styles.disabledButton]}
					>
						<Text style={styles.addButtonText}>{busy ? 'Adding…' : 'Add to cart'}</Text>
					</Pressable>
				</View>
			</View>
		</View>
	);
}

function FeaturedVehicleCard({ vehicle, onOpen }: { vehicle: VehicleListing; onOpen: () => void }) {
	return (
		<Pressable accessibilityRole="button" onPress={onOpen} style={styles.featuredCard}>
			<Image accessibilityLabel={vehicle.title} source={{ uri: vehicle.image_url }} style={styles.featuredImage} />
			<View style={styles.featuredCopy}>
				<Text numberOfLines={1} style={styles.featuredTitle}>{vehicle.title}</Text>
				<Text style={styles.featuredMeta}>{vehicle.year}  ·  {vehicle.location}</Text>
				<Text style={styles.featuredPrice}>{formatPrice(vehicle.price, vehicle.currency)}</Text>
			</View>
		</Pressable>
	);
}

function Avatar({ name, email, large = false }: { name?: string; email?: string; large?: boolean }) {
	return (
		<View style={[styles.avatar, large && styles.avatarLarge]}>
			<Text style={[styles.avatarText, large && styles.avatarTextLarge]}>{userInitials(name, email)}</Text>
		</View>
	);
}

function SheetAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={styles.sheetAction}>
			<MaterialCommunityIcons name={icon} size={21} color={colors.accent} />
			<Text style={styles.sheetActionText}>{label}</Text>
			<MaterialCommunityIcons name="chevron-right" size={21} color={colors.muted} />
		</Pressable>
	);
}

function VehicleDetailsSheet({
	vehicle,
	busy,
	bottomInset,
	onClose,
	onAdd,
	onContact,
}: {
	vehicle: VehicleListing;
	busy: boolean;
	bottomInset: number;
	onClose: () => void;
	onAdd: () => void;
	onContact: () => void;
}) {
	return (
		<View style={styles.modalRoot}>
			<Pressable accessibilityRole="button" accessibilityLabel="Close vehicle details" style={styles.modalScrim} onPress={onClose} />
			<ScrollView style={styles.detailSheet} contentContainerStyle={{ paddingBottom: Math.max(bottomInset, 20) }}>
				<View style={styles.detailImageWrap}>
					<Image accessibilityLabel={vehicle.title} source={{ uri: vehicle.image_url }} style={styles.detailImage} />
					<Pressable accessibilityRole="button" accessibilityLabel="Close vehicle details" onPress={onClose} style={styles.detailClose}>
						<MaterialCommunityIcons name="close" size={22} color={colors.text} />
					</Pressable>
				</View>
				<View style={styles.detailContent}>
					<View style={styles.detailAvailability}><View style={styles.availabilityDot} /><Text style={styles.detailAvailabilityText}>{vehicle.stock > 0 && vehicle.status === 'active' ? 'Available now' : 'Currently unavailable'}</Text></View>
					<Text style={styles.detailTitle}>{vehicle.title}</Text>
					<Text style={styles.detailPrice}>{formatPrice(vehicle.price, vehicle.currency)}</Text>
					<Text style={styles.detailQuantity}>Quantity available: {Math.min(vehicle.stock, 1)}</Text>
					<Text style={styles.detailDescription}>{vehicle.description}</Text>
					<Text style={styles.detailSectionLabel}>VEHICLE DETAILS</Text>
					<View style={styles.specGrid}>
						<Spec label="Year" value={String(vehicle.year)} />
						<Spec label="Mileage" value={`${vehicle.mileage.toLocaleString()} km`} />
						<Spec label="Condition" value={vehicle.condition} />
						<Spec label="Transmission" value={vehicle.transmission} />
						<Spec label="Fuel" value={vehicle.fuel_type} />
						<Spec label="Body type" value={vehicle.body_type} />
						<Spec label="Location" value={vehicle.location} />
					</View>
					<Pressable accessibilityRole="button" disabled={busy || vehicle.stock < 1 || vehicle.status !== 'active'} onPress={onAdd} style={[styles.detailPrimary, (busy || vehicle.stock < 1 || vehicle.status !== 'active') && styles.disabledButton]}>
						<Text style={styles.detailPrimaryText}>{busy ? 'Adding…' : 'Add to cart'}</Text>
					</Pressable>
					<Pressable accessibilityRole="button" onPress={onContact} style={styles.detailSecondary}>
						<MaterialCommunityIcons name="whatsapp" size={18} color={colors.accent} />
						<Text style={styles.detailSecondaryText}>Ask about this vehicle</Text>
					</Pressable>
				</View>
			</ScrollView>
		</View>
	);
}

function Spec({ label, value }: { label: string; value: string }) {
	return <View style={styles.specItem}><Text style={styles.specLabel}>{label}</Text><Text numberOfLines={2} style={styles.specValue}>{value}</Text></View>;
}

function CartCard({ item, busy, onRemove }: { item: CartItem; busy: boolean; onRemove: () => void }) {
	const vehicle = item.vehicle_listing;
	return (
		<View style={styles.cartCard}>
			<Image accessibilityLabel={vehicle.title} source={{ uri: vehicle.image_url }} style={styles.cartImage} />
			<View style={styles.cartDetails}>
				<Text style={styles.vehicleTitle}>{vehicle.title}</Text>
				<Text style={styles.vehicleSpecs}>{vehicle.year}  ·  {vehicle.mileage.toLocaleString()} km</Text>
				<Text style={styles.vehicleQuantity}>Qty {item.quantity}</Text>
				<Text style={styles.price}>{formatPrice(vehicle.price, vehicle.currency)}</Text>
				<Pressable accessibilityRole="button" disabled={busy} onPress={onRemove} style={styles.removeButton}>
					<Text style={styles.removeText}>{busy ? 'Removing…' : 'Remove'}</Text>
				</Pressable>
			</View>
		</View>
	);
}

function TabButton({ icon, label, active, onPress }: { icon: IconName; label: string; active: boolean; onPress: () => void }) {
	return (
		<Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={styles.tabButton}>
			<MaterialCommunityIcons name={icon} size={21} color={active ? colors.accent : colors.muted} />
			<Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
		</Pressable>
	);
}

function LoadingState({ label }: { label: string }) {
	return <View style={styles.state}><ActivityIndicator color={colors.accent} /><Text style={styles.stateText}>{label}</Text></View>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<View style={styles.messagePanel}>
			<Text accessibilityRole="alert" style={styles.errorText}>{message}</Text>
			<Pressable accessibilityRole="button" onPress={onRetry} style={styles.refreshButton}>
				<Text style={styles.refreshText}>Try again</Text>
			</Pressable>
		</View>
	);
}

function EmptyState({ title, message }: { title: string; message: string }) {
	return <View style={styles.messagePanel}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text></View>;
}

const styles = StyleSheet.create({
	safeArea: { backgroundColor: colors.background, flex: 1 },
	header: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
	brandRow: { alignItems: 'center', flexDirection: 'row' },
	brandName: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 2.1, textTransform: 'uppercase' },
	brandAccent: { color: colors.accent },
	headerActions: { alignItems: 'center', flexDirection: 'row', gap: 10 },
	headerIconButton: { alignItems: 'center', height: 44, justifyContent: 'center', position: 'relative', width: 44 },
	cartBadge: { alignItems: 'center', backgroundColor: colors.accent, borderColor: colors.background, borderRadius: 9, borderWidth: 1.5, height: 18, justifyContent: 'center', minWidth: 18, paddingHorizontal: 3, position: 'absolute', right: 2, top: 1 },
	cartBadgeText: { color: colors.background, fontSize: 9, fontWeight: '900' },
	avatarButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.accent, borderRadius: 22, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
	avatarText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
	avatar: { alignItems: 'center', backgroundColor: '#17232a', borderColor: colors.accent, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
	avatarLarge: { borderRadius: 27, height: 54, width: 54 },
	avatarTextLarge: { fontSize: 18 },
	content: { paddingHorizontal: 18, paddingTop: 17, paddingBottom: 30 },
	hero: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, height: 345, justifyContent: 'flex-end', marginBottom: 26, overflow: 'hidden', position: 'relative' },
	heroImage: { height: '100%', left: 0, position: 'absolute', top: 0, width: '100%' },
	heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,12,16,0.68)' },
	heroCopy: { padding: 18 },
	heroEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
	heroTitle: { color: colors.text, fontSize: 30, fontWeight: '800', lineHeight: 35, marginTop: 10 },
	heroDescription: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
	heroButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 4, justifyContent: 'center', marginTop: 18, minHeight: 46 },
	heroButtonText: { color: '#0b0c10', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
	heroSecondaryButton: { alignItems: 'center', borderColor: colors.muted, borderRadius: 4, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 9, minHeight: 44 },
	heroSecondaryText: { color: colors.text, fontSize: 12, fontWeight: '700' },
	featuredRow: { gap: 12, paddingBottom: 9, paddingRight: 18 },
	featuredCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, marginBottom: 6, overflow: 'hidden', width: 250 },
	featuredImage: { backgroundColor: colors.border, height: 145, width: '100%' },
	featuredCopy: { padding: 12 },
	featuredTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
	featuredMeta: { color: colors.muted, fontSize: 10, marginTop: 5 },
	featuredPrice: { color: colors.accent, fontSize: 14, fontWeight: '800', marginTop: 9 },
	sectionHeading: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
	sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 2 },
	textLink: { color: colors.accent, fontSize: 11, fontWeight: '700', marginBottom: 2 },
	valueSection: { borderBottomColor: colors.border, borderBottomWidth: 1, borderTopColor: colors.border, borderTopWidth: 1, marginTop: 14, paddingVertical: 24 },
	valueCopy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
	serviceSection: { borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 17, paddingTop: 23 },
	serviceIntro: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 9 },
	serviceRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: 12, minHeight: 68, paddingVertical: 10 },
	serviceIcon: { alignItems: 'center', backgroundColor: colors.surface, height: 39, justifyContent: 'center', width: 39 },
	serviceCopy: { flex: 1 },
	serviceTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
	serviceDescription: { color: colors.muted, fontSize: 10, marginTop: 4 },
	contactSection: { paddingVertical: 24 },
	contactTitle: { color: colors.text, fontSize: 19, fontWeight: '700', marginTop: 4 },
	contactCopy: { color: colors.muted, fontSize: 13, marginTop: 9 },
	contactButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 4, justifyContent: 'center', marginTop: 15, minHeight: 44, paddingHorizontal: 18 },
	contactButtonText: { color: '#0b0c10', fontSize: 12, fontWeight: '800' },
	eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginBottom: 8 },
	pageTitle: { color: colors.text, fontSize: 27, fontWeight: '600' },
	intro: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 20 },
	searchBox: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 9, minHeight: 48, paddingHorizontal: 13 },
	searchInput: { color: colors.text, flex: 1, fontSize: 13, minHeight: 46, paddingVertical: 0 },
	filterRow: { gap: 8, paddingVertical: 13 },
	filterChip: { borderColor: colors.border, borderRadius: 18, borderWidth: 1, justifyContent: 'center', minHeight: 36, paddingHorizontal: 14 },
	filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
	filterText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
	filterTextActive: { color: colors.background, fontWeight: '800' },
	resultsRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
	resultCount: { color: colors.muted, fontSize: 11 },
	sortButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 40, paddingHorizontal: 11 },
	sortText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
	vehicleCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: 15, overflow: 'hidden' },
	vehicleImage: { backgroundColor: colors.border, height: 190, width: '100%' },
	vehicleDetails: { padding: 15 },
	vehicleTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
	vehicleSpecs: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 6 },
	vehicleQuantity: { color: colors.muted, fontSize: 10, fontWeight: '600', marginTop: 4 },
	vehicleLocation: { color: colors.muted, fontSize: 11, marginTop: 3 },
	availabilityRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 3 },
	availabilityDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
	vehicleActionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
	price: { color: colors.accent, fontSize: 15, fontWeight: '700', marginTop: 10 },
	addButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 6, justifyContent: 'center', minHeight: 40, paddingHorizontal: 14 },
	addButtonText: { color: '#071718', fontSize: 12, fontWeight: '800' },
	titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
	refreshButton: { alignSelf: 'flex-start', borderColor: colors.border, borderRadius: 6, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
	refreshText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
	cartCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginBottom: 12, overflow: 'hidden' },
	cartImage: { backgroundColor: colors.border, height: 142, width: 128 },
	cartDetails: { flex: 1, justifyContent: 'center', padding: 12 },
	removeButton: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 5 },
	removeText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
	clearButton: { alignItems: 'center', backgroundColor: '#2b1d22', borderColor: '#75414a', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
	clearButtonText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
	cartSummary: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 15 },
	summaryLabel: { color: colors.muted, fontSize: 10 },
	summaryAmount: { color: colors.accent, fontSize: 17, fontWeight: '800', marginTop: 4 },
	checkoutActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
	checkoutButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 10, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
	checkoutButtonText: { color: '#071718', fontSize: 12, fontWeight: '900' },
	state: { alignItems: 'center', gap: 12, paddingVertical: 36 },
	stateText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
	messagePanel: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 12, marginTop: 12, padding: 20 },
	errorText: { color: colors.danger, fontSize: 13, lineHeight: 20, textAlign: 'center' },
	emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
	successText: { color: colors.accent, fontSize: 12, marginBottom: 12 },
	noticeToast: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surface, borderColor: colors.accent, borderRadius: 11, borderWidth: 1, flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 10, minHeight: 46, paddingHorizontal: 13, zIndex: 5 },
	noticeToastText: { color: colors.text, flex: 1, fontSize: 12, fontWeight: '600' },
	disabledButton: { opacity: 0.5 },
	accountContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
	accountLanding: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
	accountPreview: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 15, padding: 14 },
	accountPreviewText: { flex: 1, gap: 4 },
	accountAction: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 55 },
	accountActionText: { color: colors.text, flex: 1, fontSize: 13, fontWeight: '600' },
	accountPanel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginTop: 22, padding: 18 },
	accountName: { color: colors.text, fontSize: 17, fontWeight: '700' },
	accountEmail: { color: colors.muted, fontSize: 13, marginTop: 7 },
	logoutButton: { alignItems: 'center', borderColor: '#496065', borderRadius: 6, borderWidth: 1, justifyContent: 'center', marginTop: 22, minHeight: 50 },
	logoutText: { color: colors.text, fontSize: 13, fontWeight: '600' },
	modalRoot: { flex: 1, justifyContent: 'flex-end' },
	modalScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.66)' },
	sheet: { backgroundColor: colors.surface, borderColor: colors.border, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderWidth: 1, paddingHorizontal: 20, paddingTop: 10 },
	sheetHandle: { alignSelf: 'center', backgroundColor: colors.border, height: 4, marginBottom: 16, width: 38 },
	sheetTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
	sheetClose: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
	accountSheetIdentity: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 13, paddingVertical: 19 },
	sheetAction: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 54 },
	sheetActionText: { color: colors.text, flex: 1, fontSize: 13, fontWeight: '600' },
	sheetSignOut: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 52, paddingTop: 8 },
	sheetSignOutText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
	detailSheet: { backgroundColor: colors.background, maxHeight: '94%' },
	detailImageWrap: { height: 255, position: 'relative' },
	detailImage: { backgroundColor: colors.surface, height: '100%', width: '100%' },
	detailClose: { alignItems: 'center', backgroundColor: 'rgba(11,12,16,0.78)', borderColor: colors.border, borderWidth: 1, height: 42, justifyContent: 'center', position: 'absolute', right: 16, top: 16, width: 42 },
	detailContent: { paddingHorizontal: 20, paddingTop: 20 },
	detailAvailability: { alignItems: 'center', flexDirection: 'row', gap: 7 },
	detailAvailabilityText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
	detailTitle: { color: colors.text, fontSize: 25, fontWeight: '800', lineHeight: 30, marginTop: 9 },
	detailPrice: { color: colors.accent, fontSize: 20, fontWeight: '800', marginTop: 9 },
	detailQuantity: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 5 },
	detailDescription: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 15 },
	detailSectionLabel: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 24 },
	specGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 7 },
	specItem: { borderBottomColor: colors.border, borderBottomWidth: 1, minHeight: 58, justifyContent: 'center', paddingVertical: 9, width: '50%' },
	specLabel: { color: colors.muted, fontSize: 10 },
	specValue: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 4, paddingRight: 10 },
	detailPrimary: { alignItems: 'center', backgroundColor: colors.accent, justifyContent: 'center', marginTop: 22, minHeight: 50 },
	detailPrimaryText: { color: colors.background, fontSize: 13, fontWeight: '900' },
	detailSecondary: { alignItems: 'center', borderColor: colors.border, borderWidth: 1, flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 9, minHeight: 48 },
	detailSecondaryText: { color: colors.text, fontSize: 12, fontWeight: '700' },
	tabBar: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: 8, paddingTop: 11 },
	tabButton: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 56, paddingTop: 2 },
	tabText: { color: colors.muted, fontSize: 10, fontWeight: '600', marginTop: 4 },
	tabTextActive: { color: colors.accent, fontWeight: '800' },
});