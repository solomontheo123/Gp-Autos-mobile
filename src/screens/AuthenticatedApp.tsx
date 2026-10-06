import { useEffect, useState } from 'react';
import {
	ActivityIndicator,
	AppState,
	Image,
	Linking,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';

import { ApiError, cartApi, vehicleApi, type CartItem, type VehicleListing } from '../config/api';
import { useAuth } from '../auth/AuthProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tab = 'home' | 'vehicles' | 'cart' | 'account';

const colors = {
	background: '#0b0c10',
	surface: '#1f2833',
	border: '#2f3e46',
	accent: '#66fcf1',
	text: '#ffffff',
	muted: '#c5c6c7',
	danger: '#ff9c9c',
};

const WHATSAPP_URL = 'https://wa.me/2348168606202?text=Hello%20GP%20Autos%2C%20I%20would%20like%20to%20learn%20more%20about%20your%20vehicles.';

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

	const addVehicle = async (vehicle: VehicleListing) => {
		setBusyVehicleId(vehicle.id);
		setNotice(null);
		setVehiclesError(null);
		try {
			await cartApi.addCartItem(vehicle.id);
			const latestCart = await cartApi.getCart();
			setCart(latestCart);
			setNotice(`${vehicle.title} added to your cart.`);
		} catch (error: unknown) {
			setVehiclesError(messageFor(error));
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

	const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
	const openWhatsApp = async () => {
		try {
			await Linking.openURL(WHATSAPP_URL);
		} catch {
			setNotice('WhatsApp could not be opened. Please try again.');
		}
	};

	return (
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.header}>
				<BrandMark />
				<Text style={styles.headerCaption}>PRE-OWNED, WELL CONSIDERED</Text>
			</View>

			{tab === 'home' ? (
				<ScrollView contentContainerStyle={styles.content}>
					<View style={styles.hero}>
						<Image
							accessibilityLabel="Featured GP Autos vehicle"
							source={{ uri: vehicles[0]?.image_url }}
							style={styles.heroImage}
						/>
						<View style={styles.heroShade} />
						<View style={styles.heroCopy}>
							<Text style={styles.heroEyebrow}>A BETTER WAY TO BUY YOUR NEXT CAR</Text>
							<Text style={styles.heroTitle}>Find the car that moves you.</Text>
							<Text style={styles.heroDescription}>
								Thoughtfully selected vehicles. Clear details. A purchase you can feel good about.
							</Text>
							<Pressable accessibilityRole="button" onPress={() => setTab('vehicles')} style={styles.heroButton}>
								<Text style={styles.heroButtonText}>Browse vehicles</Text>
							</Pressable>
							<Pressable accessibilityRole="button" onPress={() => void openWhatsApp()} style={styles.heroSecondaryButton}>
								<Text style={styles.heroSecondaryText}>WhatsApp / Contact</Text>
							</Pressable>
						</View>
					</View>

					<View style={styles.sectionHeading}>
						<View>
							<Text style={styles.eyebrow}>THE RIGHT KIND OF DIFFERENT</Text>
							<Text style={styles.sectionTitle}>Find your next favourite.</Text>
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
					{vehicles.slice(0, 3).map((vehicle) => (
						<VehicleCard
							key={vehicle.id}
							vehicle={vehicle}
							busy={busyVehicleId === vehicle.id}
							onAdd={() => void addVehicle(vehicle)}
						/>
					))}

					<View style={styles.valueSection}>
						<Text style={styles.eyebrow}>CONFIDENCE COMES STANDARD</Text>
						<Text style={styles.sectionTitle}>Good cars. No guesswork.</Text>
						<Text style={styles.valueCopy}>Every listing gives you clear details, from mileage to condition.</Text>
						<Text style={styles.valueCopy}>Local vehicles, local context, and prices in naira.</Text>
					</View>

					<View style={styles.contactSection}>
						<Text style={styles.eyebrow}>TALK TO GP AUTOS</Text>
						<Text style={styles.contactTitle}>Ikeja / Ogba, Lagos</Text>
						<Text style={styles.contactCopy}>WhatsApp: +234 816 860 6202</Text>
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
					{notice ? <Text style={styles.successText}>{notice}</Text> : null}
					{vehiclesError ? <ErrorState message={vehiclesError} onRetry={() => void loadVehicles()} /> : null}
					{vehiclesLoading ? <LoadingState label="Loading available vehicles" /> : null}
					{!vehiclesLoading && !vehiclesError && vehicles.length === 0 ? (
						<EmptyState title="No vehicles available" message="Check back soon for new listings." />
					) : null}
					{vehicles.map((vehicle) => (
						<VehicleCard
							key={vehicle.id}
							vehicle={vehicle}
							busy={busyVehicleId === vehicle.id}
							onAdd={() => void addVehicle(vehicle)}
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
						<EmptyState title="Your cart is empty" message="Browse the collection and add a vehicle to begin." />
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
						<Pressable
							accessibilityRole="button"
							disabled={cartBusy || cartLoading}
							onPress={() => void clearCart()}
							style={[styles.clearButton, (cartBusy || cartLoading) && styles.disabledButton]}
						>
							<Text style={styles.clearButtonText}>{cartBusy ? 'Clearing…' : 'Clear cart'}</Text>
						</Pressable>
					) : null}
				</ScrollView>
			) : null}

			{tab === 'account' ? (
				<View style={styles.accountContent}>
					<Text style={styles.eyebrow}>ACCOUNT</Text>
					<Text style={styles.pageTitle}>You’re signed in.</Text>
					<View style={styles.accountPanel}>
						<Text style={styles.accountName}>{user?.name}</Text>
						<Text style={styles.accountEmail}>{user?.email}</Text>
					</View>
					<Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.logoutButton}>
						<Text style={styles.logoutText}>Sign out</Text>
					</Pressable>
				</View>
			) : null}

			<View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
				<TabButton label="Home" active={tab === 'home'} onPress={() => setTab('home')} />
				<TabButton label="Vehicles" active={tab === 'vehicles'} onPress={() => setTab('vehicles')} />
				<TabButton
					label={`Cart${cartCount ? ` (${cartCount})` : ''}`}
					active={tab === 'cart'}
					onPress={() => {
						if (tab === 'cart') void loadCart();
						else setTab('cart');
					}}
				/>
				<TabButton label="Account" active={tab === 'account'} onPress={() => setTab('account')} />
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

function VehicleCard({ vehicle, busy, onAdd }: { vehicle: VehicleListing; busy: boolean; onAdd: () => void }) {
	return (
		<View style={styles.vehicleCard}>
			<Image accessibilityLabel={vehicle.title} source={{ uri: vehicle.image_url }} style={styles.vehicleImage} />
			<View style={styles.vehicleDetails}>
				<Text style={styles.vehicleTitle}>{vehicle.title}</Text>
				<Text style={styles.vehicleSpecs}>{vehicle.year}  ·  {vehicle.mileage.toLocaleString()} km  ·  {vehicle.condition}</Text>
				<Text style={styles.vehicleLocation}>{vehicle.location}</Text>
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

function CartCard({ item, busy, onRemove }: { item: CartItem; busy: boolean; onRemove: () => void }) {
	const vehicle = item.vehicle_listing;
	return (
		<View style={styles.cartCard}>
			<Image accessibilityLabel={vehicle.title} source={{ uri: vehicle.image_url }} style={styles.cartImage} />
			<View style={styles.cartDetails}>
				<Text style={styles.vehicleTitle}>{vehicle.title}</Text>
				<Text style={styles.vehicleSpecs}>{vehicle.year}  ·  {vehicle.mileage.toLocaleString()} km</Text>
				<Text style={styles.price}>{formatPrice(vehicle.price, vehicle.currency)}</Text>
				<Pressable accessibilityRole="button" disabled={busy} onPress={onRemove} style={styles.removeButton}>
					<Text style={styles.removeText}>{busy ? 'Removing…' : 'Remove'}</Text>
				</Pressable>
			</View>
		</View>
	);
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
	return (
		<Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={styles.tabButton}>
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
	header: { borderBottomColor: colors.border, borderBottomWidth: 1, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 15 },
	brandRow: { alignItems: 'center', flexDirection: 'row' },
	brandName: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 2.1, textTransform: 'uppercase' },
	brandAccent: { color: colors.accent },
	headerCaption: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 1.5, marginTop: 12 },
	content: { padding: 20, paddingBottom: 28 },
	hero: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, height: 390, justifyContent: 'flex-end', marginBottom: 30, overflow: 'hidden', position: 'relative' },
	heroImage: { height: '100%', left: 0, position: 'absolute', top: 0, width: '100%' },
	heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,12,16,0.62)' },
	heroCopy: { padding: 20 },
	heroEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
	heroTitle: { color: colors.text, fontSize: 34, fontWeight: '800', lineHeight: 39, marginTop: 12 },
	heroDescription: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
	heroButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 4, justifyContent: 'center', marginTop: 18, minHeight: 46 },
	heroButtonText: { color: '#0b0c10', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
	heroSecondaryButton: { alignItems: 'center', borderColor: colors.muted, borderRadius: 4, borderWidth: 1, justifyContent: 'center', marginTop: 9, minHeight: 44 },
	heroSecondaryText: { color: colors.text, fontSize: 12, fontWeight: '700' },
	sectionHeading: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
	sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 2 },
	textLink: { color: colors.accent, fontSize: 11, fontWeight: '700', marginBottom: 2 },
	valueSection: { borderBottomColor: colors.border, borderBottomWidth: 1, borderTopColor: colors.border, borderTopWidth: 1, marginTop: 14, paddingVertical: 24 },
	valueCopy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
	contactSection: { paddingVertical: 24 },
	contactTitle: { color: colors.text, fontSize: 19, fontWeight: '700', marginTop: 4 },
	contactCopy: { color: colors.muted, fontSize: 13, marginTop: 9 },
	contactButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 4, justifyContent: 'center', marginTop: 15, minHeight: 44, paddingHorizontal: 18 },
	contactButtonText: { color: '#0b0c10', fontSize: 12, fontWeight: '800' },
	eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginBottom: 8 },
	pageTitle: { color: colors.text, fontSize: 27, fontWeight: '600' },
	intro: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 20 },
	vehicleCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: 15, overflow: 'hidden' },
	vehicleImage: { backgroundColor: colors.border, height: 190, width: '100%' },
	vehicleDetails: { padding: 15 },
	vehicleTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
	vehicleSpecs: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 6 },
	vehicleLocation: { color: colors.muted, fontSize: 11, marginTop: 3 },
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
	clearButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 6, borderWidth: 1, justifyContent: 'center', marginTop: 8, minHeight: 46 },
	clearButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
	state: { alignItems: 'center', gap: 12, paddingVertical: 36 },
	stateText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
	messagePanel: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 12, marginTop: 12, padding: 20 },
	errorText: { color: colors.danger, fontSize: 13, lineHeight: 20, textAlign: 'center' },
	emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
	successText: { color: colors.accent, fontSize: 12, marginBottom: 12 },
	disabledButton: { opacity: 0.5 },
	accountContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
	accountPanel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginTop: 22, padding: 18 },
	accountName: { color: colors.text, fontSize: 17, fontWeight: '700' },
	accountEmail: { color: colors.muted, fontSize: 13, marginTop: 7 },
	logoutButton: { alignItems: 'center', borderColor: '#496065', borderRadius: 6, borderWidth: 1, justifyContent: 'center', marginTop: 22, minHeight: 50 },
	logoutText: { color: colors.text, fontSize: 13, fontWeight: '600' },
	tabBar: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingTop: 6 },
	tabButton: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 48 },
	tabText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
	tabTextActive: { color: colors.accent, fontWeight: '800' },
});