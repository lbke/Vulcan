import React from 'react'

const RequestLocaleProvider = ({ req, children }) => {
    const locale = req.headers["accept-language"].split(',')[0].split('-')[0]
    return React.cloneElement(React.Children.only(children), { requestLocale: locale })
}
export default RequestLocaleProvider