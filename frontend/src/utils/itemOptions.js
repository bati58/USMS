export function uniqueItemsByName(items = []) {
    const unique = new Map()

    items.forEach((item) => {
        const name = String(item?.name || item?.item || '').trim()
        const key = name.toLocaleLowerCase()
        if (name && !unique.has(key)) unique.set(key, { ...item, name })
    })

    return Array.from(unique.values())
}
