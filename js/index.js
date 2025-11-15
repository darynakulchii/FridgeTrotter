import React, { useState } from 'react';

// --- Mock Components (Заглушки, щоб додаток працював) ---

// Mock lucide-react icons (Заглушки для іконок)
// У вашому реальному проекті ви будете імпортувати їх з 'lucide-react'
const Menu = ({ className }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
const Bell = ({ className }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
const MessageCircle = ({ className }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>;
const User = ({ className }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;

// Mock Button component (Заглушка для ./components/ui/button)
// Вона просто передає onClick та className
const Button = ({ variant, size, onClick, className, children }) => (
    <button onClick={onClick} className={`${className} rounded-md transition-colors`}>
        {children}
    </button>
);

// Mock Sidebar component (Заглушка для ./components/Sidebar)
const Sidebar = ({ isOpen, onClose }) => (
    <>
        {/* Overlay */}
        <div
            className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${
                isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={onClose}
        ></div>
        {/* Sidebar Panel */}
        <div
            className={`fixed top-0 left-0 h-full w-64 bg-[#281822] text-[#D3CBC4] transform ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            } transition-transform duration-300 ease-in-out z-50 p-4`}
        >
            <button onClick={onClose} className="text-2xl mb-4 hover:text-white">&times;</button>
            <nav>
                <ul>
                    <li className="py-2 px-3 hover:bg-[#48192E] rounded-md cursor-pointer">Головна</li>
                    <li className="py-2 px-3 hover:bg-[#48192E] rounded-md cursor-pointer">Мій профіль</li>
                    <li className="py-2 px-3 hover:bg-[#48192E] rounded-md cursor-pointer">Налаштування</li>
                    <li className="py-2 px-3 hover:bg-[#48192E] rounded-md cursor-pointer">Вийти</li>
                </ul>
            </nav>
        </div>
    </>
);

// Mock Page Sections (Заглушки для сторінок)
const ToursSection = () => <div className="p-6 bg-white/20 rounded-lg shadow-md">
    <h2 className="text-2xl font-bold text-[#281822] mb-4">Тури</h2>
    <p className="text-[#281822]">Тут буде відображатися контент для секції турів...</p>
</div>;

const ForumSection = () => <div className="p-6 bg-white/20 rounded-lg shadow-md">
    <h2 className="text-2xl font-bold text-[#281822] mb-4">Форум</h2>
    <p className="text-[#281822]">Тут буде відображатися контент для секції форуму...</p>
</div>;

const TravelCompanionsSection = () => <div className="p-6 bg-white/20 rounded-lg shadow-md">
    <h2 className="text-2xl font-bold text-[#281822] mb-4">Пошук компанії</h2>
    <p className="text-[#281822]">Тут буде відображатися контент для пошуку компаньйонів...</p>
</div>;

const ProfilePage = () => <div className="p-6 bg-white/20 rounded-lg shadow-md">
    <h2 className="text-2xl font-bold text-[#281822] mb-4">Сторінка профілю</h2>
    <p className="text-[#281822]">Тут буде відображатися контент профілю користувача...</p>
</div>;

// --- Ваш компонент App, перетворений на .jsx ---

export default function App() {
    // Видалено <PageType> з useState. JavaScript не використовує типізацію.
    const [currentPage, setCurrentPage] = useState('tours');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[#D3CBC4]">
            {/* Header */}
            <header className="bg-[#281822] text-[#D3CBC4] px-4 py-4 flex items-center justify-between sticky top-0 z-40 shadow-lg">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="text-[#D3CBC4] hover:bg-[#48192E] hover:text-[#D3CBC4] p-2" // Додав p-2 для кращого вигляду
                    >
                        <Menu className="h-6 w-6" />
                    </Button>
                    <h1 className="text-2xl font-semibold">FridgeTrotter</h1>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-[#D3CBC4] hover:bg-[#48192E] hover:text-[#D3CBC4] relative p-2" // Додав p-2
                    >
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-1 right-1 h-2 w-2 bg-[#D3CBC4] rounded-full"></span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-[#D3CBC4] hover:bg-[#48192E] hover:text-[#D3CBC4] p-2" // Додав p-2
                    >
                        <MessageCircle className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentPage('profile')}
                        className="text-[#D3CBC4] hover:bg-[#48192E] hover:text-[#D3CBC4] p-2" // Додав p-2
                    >
                        <User className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Navigation Tabs - hide on profile page */}
            {currentPage !== 'profile' && (
                <nav className="bg-[#2D4952] px-4 py-3 flex gap-2 overflow-x-auto shadow-md">
                    <Button
                        onClick={() => setCurrentPage('tours')}
                        className={`${
                            currentPage === 'tours'
                                ? 'bg-[#48192E] text-[#D3CBC4] hover:bg-[#48192E]/90'
                                : 'bg-transparent text-[#D3CBC4] hover:bg-[#48192E]/50'
                        } px-4 py-2 text-sm font-medium`} // Додав відступи та стилі
                    >
                        Тури
                    </Button>
                    <Button
                        onClick={() => setCurrentPage('forum')}
                        className={`${
                            currentPage === 'forum'
                                ? 'bg-[#48192E] text-[#D3CBC4] hover:bg-[#48192E]/90'
                                : 'bg-transparent text-[#D3CBC4] hover:bg-[#48192E]/50'
                        } px-4 py-2 text-sm font-medium`} // Додав відступи та стилі
                    >
                        Форум
                    </Button>
                    <Button
                        onClick={() => setCurrentPage('companions')}
                        className={`${
                            currentPage === 'companions'
                                ? 'bg-[#48192E] text-[#D3CBC4] hover:bg-[#48192E]/90'
                                : 'bg-transparent text-[#D3CBC4] hover:bg-[#48192E]/50'
                        } px-4 py-2 text-sm font-medium`} // Додав відступи та стилі
                    >
                        Пошук компанії
                    </Button>
                </nav>
            )}

            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main Content */}
            <main className="p-4 sm:p-6">
                {currentPage === 'tours' && <ToursSection />}
                {currentPage === 'forum' && <ForumSection />}
                {currentPage === 'companions' && <TravelCompanionsSection />}
                {currentPage === 'profile' && <ProfilePage />}
            </main>
        </div>
    );
}