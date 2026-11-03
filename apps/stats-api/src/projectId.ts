import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const dirPath = path.join(process.cwd(), '.lens');
const idFilePath = path.join(dirPath, 'project-id.json');

export function getOrCreateProjectId(): string {
    try {
        if (fs.existsSync(idFilePath)) {
            const data = fs.readFileSync(idFilePath, 'utf8');
            const parsed = JSON.parse(data);
            if (parsed && parsed.projectId) {
                return parsed.projectId;
            }
        }
    } catch (error) {
        console.warn('Project ID file is corrupted or unreadable, generating a new one.');
    }

    const newProjectId = crypto.randomUUID();

    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(idFilePath, JSON.stringify({ projectId: newProjectId }, null, 2), 'utf8');
    } catch (error) {
        console.error('Warning: Unwritable folder, falling back to a session-only ID.', error);
        process.stderr.write('Warning: Could not write project ID to disk, using session-only ID.\n');
        return newProjectId;
    }

    return newProjectId;
}