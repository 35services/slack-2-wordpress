# Maintenance Guide

This document outlines important maintenance tasks and reminders for keeping the project up to date.

## Postman Collection Maintenance

**⚠️ CRITICAL**: The Postman collection must be kept in sync with WordPress API calls.

### When to Update

Update `WordPress_API.postman_collection.json` whenever you:

- ✅ Add a new WordPress API endpoint in `src/modules/wordpressService.js`
- ✅ Modify an existing WordPress API call (URL, method, parameters)
- ✅ Change request body structure or parameters
- ✅ Add or remove authentication requirements
- ✅ Update error handling that affects API behavior

### How to Update

1. **Identify the change**: Note what WordPress API call was modified
2. **Update the collection**: 
   - Open `WordPress_API.postman_collection.json`
   - Find the corresponding request (or create a new one)
   - Update URL, method, headers, body as needed
   - Update the description if behavior changed
3. **Test the collection**: Import into Postman and verify the request works
4. **Document changes**: Update `POSTMAN_SETUP.md` if new setup steps are needed

### Checklist

When modifying WordPress API calls, use this checklist:

- [ ] Updated the corresponding Postman request
- [ ] Added new requests if new endpoints were introduced
- [ ] Updated request bodies to match code
- [ ] Updated descriptions to reflect changes
- [ ] Tested the Postman collection
- [ ] Updated `POSTMAN_SETUP.md` if needed

## Related Files

- **Source Code**: `src/modules/wordpressService.js` - Contains all WordPress API calls
- **Postman Collection**: `WordPress_API.postman_collection.json` - Must mirror the source code
- **Setup Guide**: `POSTMAN_SETUP.md` - Instructions for using the collection

## Reminders

Reminders are placed in:
- ✅ Header comment in `src/modules/wordpressService.js`
- ✅ Description field in `WordPress_API.postman_collection.json`
- ✅ `POSTMAN_SETUP.md` maintenance section
- ✅ `README.md` documentation section

