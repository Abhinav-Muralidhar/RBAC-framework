/**
 * Unauthorized Page
 * 
 * Displayed when user lacks permission to access a resource.
 */

import { ShieldAlert, Mail } from 'lucide-react';
import './UnauthorizedPage.css';

export function UnauthorizedPage() {
    return (
        <div className="unauthorized-page">
            <div className="unauthorized-card">
                <div className="unauthorized-icon">
                    <ShieldAlert size={64} />
                </div>

                <h1>Access Denied</h1>
                <p className="unauthorized-message">
                    You don't have permission to access this page or resource.
                    Please contact your system administrator if you believe this is an error.
                </p>

                <div className="unauthorized-actions">



                    <a
                        href="mailto:support@crescent.com"
                        className="btn btn-secondary"
                    >
                        <Mail size={18} />
                        Contact Support
                    </a>
                </div>

                <div className="unauthorized-footer">
                    <p>
                        Error Code: <code>403 FORBIDDEN</code>
                    </p>
                </div>
            </div>
        </div>
    );
}
