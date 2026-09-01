import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const THEME_KEY = 'sms-theme'

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'light'

        const savedTheme = window.localStorage.getItem(THEME_KEY)
        if (savedTheme === 'light' || savedTheme === 'dark') {
            return savedTheme
        }

        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    })

    useEffect(() => {
        const root = document.documentElement
        root.classList.toggle('dark', theme === 'dark')
        root.style.colorScheme = theme
        window.localStorage.setItem(THEME_KEY, theme)
    }, [theme])

    const value = {
        theme,
        setTheme,
        toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
    }

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const context = useContext(ThemeContext)

    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }

    return context
}
