/**
 * Finds the first top-level `const name = [ ... ];` seed-data block after any
 * leading imports — common in App.jsx prefilled starters that ship data only.
 *
 * @param {string} content
 * @returns {{ name: string, start: number, end: number, declaration: string }|undefined}
 */
export function findLeadingConstArrayDeclaration(content) {
    const importOrBlankPattern = /^\s*(?:import\s[\s\S]*?;\s*|\/\/[^\n]*\n|\s*)*/;
    const headerMatch = importOrBlankPattern.exec(content);
    if (!headerMatch) {
        return undefined;
    }
    const afterImports = content.slice(headerMatch[0].length);
    const constMatch = /^const\s+(\w+)\s*=\s*\[/.exec(afterImports);
    if (!constMatch || constMatch.index !== 0) {
        return undefined;
    }
    const name = constMatch[1];
    const arrayStart = headerMatch[0].length + constMatch[0].length - 1;
    let depth = 0;
    for (let index = arrayStart; index < content.length; index++) {
        const character = content[index];
        if (character === '[') {
            depth++;
        }
        else if (character === ']') {
            depth--;
            if (depth === 0) {
                let end = index + 1;
                while (end < content.length && content[end] !== ';') {
                    end++;
                }
                if (content[end] === ';') {
                    end++;
                }
                const declarationStart = headerMatch[0].length;
                return {
                    name,
                    start: declarationStart,
                    end,
                    declaration: content.slice(declarationStart, end),
                };
            }
        }
    }
    return undefined;
}

/**
 * @param {string} content
 * @param {string} newDeclaration
 */
export function replaceLeadingConstArrayDeclaration(content, newDeclaration) {
    const existing = findLeadingConstArrayDeclaration(content);
    if (existing) {
        return `${content.slice(0, existing.start)}${newDeclaration}${content.slice(existing.end)}`;
    }
    const importOrBlankPattern = /^\s*(?:import\s[\s\S]*?;\s*|\/\/[^\n]*\n|\s*)*/;
    const headerMatch = importOrBlankPattern.exec(content);
    const insertAt = headerMatch ? headerMatch[0].length : 0;
    const spacerBefore = insertAt > 0 && content[insertAt - 1] === '\n' ? '' : '\n';
    const spacerAfter = content.slice(insertAt).trimStart().length > 0 ? '\n\n' : '\n';
    return `${content.slice(0, insertAt)}${spacerBefore}${newDeclaration}${spacerAfter}${content.slice(insertAt)}`;
}
