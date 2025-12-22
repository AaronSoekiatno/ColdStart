#!/bin/bash
# Script to check DNS propagation for SPF record

echo "🔍 Checking DNS propagation for joinhermes.co..."
echo ""

echo "Current SPF record:"
dig txt joinhermes.co +short | grep "v=spf1"
echo ""

echo "Expected SPF record:"
echo "v=spf1 include:spf.efwd.registrar-servers.com include:amazonses.com ~all"
echo ""

if dig txt joinhermes.co +short | grep -q "include:amazonses.com"; then
    echo "✅ SPF record has been updated with Amazon SES!"
else
    echo "⏳ SPF record not updated yet. Still propagating..."
    echo ""
    echo "💡 This can take 5-30 minutes. Run this script again in a few minutes:"
    echo "   bash scripts/check-dns.sh"
fi
