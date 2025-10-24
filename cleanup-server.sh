#!/bin/bash

################################################################################
# AI Dialer - Server Cleanup Script
#
# WARNING: This will remove containers, images, and optionally data!
# Use with caution!
################################################################################

echo "========================================"
echo "🧹 AI Dialer - Server Cleanup"
echo "========================================"
echo ""
echo "⚠️  WARNING: This will remove Docker containers and images"
echo ""

# Ask what to clean
echo "What do you want to clean?"
echo ""
echo "1) Stop all services (safe, keeps everything)"
echo "2) Remove containers only (keeps images and data)"
echo "3) Remove containers + images (keeps data)"
echo "4) FULL CLEANUP (removes everything including data!)"
echo "5) Nuclear option (Docker system prune everything)"
echo ""
read -p "Enter your choice (1-5): " choice
echo ""

case $choice in
    1)
        # OPTION 1: Just stop services
        echo "🛑 Stopping all services..."
        docker-compose -f docker-compose.demo.yml stop 2>/dev/null || true
        docker-compose -f docker-compose.yml stop 2>/dev/null || true
        docker stop $(docker ps -aq) 2>/dev/null || true
        echo "   ✓ All services stopped"
        echo ""
        echo "ℹ️  Services stopped but not removed. Run 'docker-compose up -d' to restart."
        ;;

    2)
        # OPTION 2: Remove containers only
        echo "🗑️  Removing containers (keeping images and data)..."

        # Stop services first
        echo "   Stopping services..."
        docker-compose -f docker-compose.demo.yml down 2>/dev/null || true
        docker-compose -f docker-compose.yml down 2>/dev/null || true

        # Remove all stopped containers
        echo "   Removing containers..."
        docker container prune -f

        echo "   ✓ Containers removed"
        echo ""
        echo "ℹ️  Images and data volumes preserved."
        ;;

    3)
        # OPTION 3: Remove containers + images
        echo "🗑️  Removing containers and images (keeping data)..."

        # Stop and remove containers
        echo "   Stopping and removing containers..."
        docker-compose -f docker-compose.demo.yml down 2>/dev/null || true
        docker-compose -f docker-compose.yml down 2>/dev/null || true

        # Remove all containers
        echo "   Removing all containers..."
        docker container rm -f $(docker ps -aq) 2>/dev/null || true

        # Remove all images
        echo "   Removing all images..."
        docker image rm -f $(docker images -aq) 2>/dev/null || true

        # Clean up
        docker system prune -f

        echo "   ✓ Containers and images removed"
        echo ""
        echo "ℹ️  Data volumes preserved. Run ./deploy.sh to rebuild."
        ;;

    4)
        # OPTION 4: FULL CLEANUP (including data!)
        echo "⚠️  ⚠️  ⚠️  WARNING ⚠️  ⚠️  ⚠️"
        echo ""
        echo "This will DELETE EVERYTHING including:"
        echo "  - All containers"
        echo "  - All images"
        echo "  - All volumes (DATABASE DATA!)"
        echo "  - All networks"
        echo ""
        read -p "Are you ABSOLUTELY SURE? Type 'DELETE EVERYTHING' to confirm: " confirm

        if [ "$confirm" = "DELETE EVERYTHING" ]; then
            echo ""
            echo "🗑️  Performing FULL cleanup..."

            # Stop and remove with volumes
            echo "   Stopping services..."
            docker-compose -f docker-compose.demo.yml down -v 2>/dev/null || true
            docker-compose -f docker-compose.yml down -v 2>/dev/null || true

            # Remove all containers
            echo "   Removing containers..."
            docker container rm -f $(docker ps -aq) 2>/dev/null || true

            # Remove all images
            echo "   Removing images..."
            docker image rm -f $(docker images -aq) 2>/dev/null || true

            # Remove all volumes
            echo "   Removing volumes..."
            docker volume rm $(docker volume ls -q) 2>/dev/null || true

            # Remove all networks
            echo "   Removing networks..."
            docker network prune -f

            # System prune
            echo "   Final cleanup..."
            docker system prune -a -f --volumes

            echo ""
            echo "   ✓ FULL cleanup complete"
            echo ""
            echo "⚠️  All data has been deleted!"
            echo "   Run ./deploy.sh to start fresh."
        else
            echo ""
            echo "❌ Cleanup cancelled (confirmation not matched)"
        fi
        ;;

    5)
        # OPTION 5: Nuclear option
        echo "☢️  Nuclear cleanup..."
        echo ""
        echo "⚠️  This will remove EVERYTHING Docker related:"
        echo "  - All containers (running and stopped)"
        echo "  - All images"
        echo "  - All volumes"
        echo "  - All networks"
        echo "  - All build cache"
        echo ""
        read -p "Type 'NUKE IT' to confirm: " confirm

        if [ "$confirm" = "NUKE IT" ]; then
            echo ""
            echo "☢️  Nuking everything..."

            # Stop all containers
            echo "   Stopping all containers..."
            docker stop $(docker ps -aq) 2>/dev/null || true

            # Nuclear cleanup
            echo "   Removing everything..."
            docker system prune -a -f --volumes

            # Extra cleanup
            docker container prune -f 2>/dev/null || true
            docker image prune -a -f 2>/dev/null || true
            docker volume prune -f 2>/dev/null || true
            docker network prune -f 2>/dev/null || true

            echo ""
            echo "   ✓ Nuclear cleanup complete"
            echo ""
            echo "ℹ️  Docker is now in pristine state."
            echo "   Run ./deploy.sh to deploy fresh."
        else
            echo ""
            echo "❌ Cleanup cancelled"
        fi
        ;;

    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "📊 Current Docker Status:"
echo ""
echo "Containers:"
docker ps -a
echo ""
echo "Images:"
docker images
echo ""
echo "Volumes:"
docker volume ls
echo ""
echo "Disk Usage:"
docker system df
echo ""
echo "========================================"
